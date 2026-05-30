using System.Text;
using HRIS.Api.Data;
using HRIS.Api.Features.Attendance.Services;
using HRIS.Api.Features.Attendance.Services.Validation;
using HRIS.Api.Features.Employees.Services;
using HRIS.Api.Features.IAM.Services;
using HRIS.Api.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// =====================
// Services
// =====================

builder.Services.AddControllers();

// Swagger/OpenAPI, Bearer support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new() { Title = "HRIS API", Version = "v1" });

    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {your JWT token}"
    });

    o.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// CORS (dev)
builder.Services.AddCors(options =>
{
    options.AddPolicy("ClientCors", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Database
var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("ConnectionStrings:Default is missing. Set it via user-secrets.");

var serverVersion = new MySqlServerVersion(new Version(8, 0, 45));
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseMySql(connectionString, serverVersion);
});

// =====================
// IAM Services
// =====================

builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IActivityLogger, ActivityLogger>();
builder.Services.AddScoped<IAdminUsersService, AdminUsersService>();

builder.Services.AddHttpContextAccessor();

// =====================
// Employee Core Services
// =====================

builder.Services.AddScoped<EmployeesService>();

// =====================
// Attendance Services
// =====================

builder.Services.AddScoped<IShiftValidationService, ShiftValidationService>();
builder.Services.AddScoped<IShiftsService, ShiftsService>();
builder.Services.AddScoped<IShiftAssignmentsService, ShiftAssignmentsService>();
builder.Services.AddScoped<IAttendanceHolidayProvider, AttendanceHolidayProvider>();
builder.Services.AddScoped<IAttendanceLogsService, AttendanceLogsService>();

// Overtime Request
builder.Services.AddScoped<OvertimeRequestService>();

// =====================
// JWT Auth (locked)
// =====================

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new InvalidOperationException("Jwt:Key is missing. Set it via user-secrets.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = false,
            ValidateAudience = false,
            RequireExpirationTime = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// =====================
// Middleware
// =====================

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();

    var swaggerAssetsPath = Path.Combine(app.Environment.ContentRootPath, "SwaggerAssets");

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(swaggerAssetsPath),
        RequestPath = "/swagger-assets"
    });

    app.UseSwaggerUI(options =>
    {
        options.InjectStylesheet("/swagger-assets/SwaggerDark.css");
    });
}

// NOTE: Local dev runs on http://localhost:5169 (no https), so skip redirect.
// app.UseHttpsRedirection();

app.UseCors("ClientCors");

app.UseMiddleware<ExceptionMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/", () => Results.Ok("HRIS API is running."));

app.Run();