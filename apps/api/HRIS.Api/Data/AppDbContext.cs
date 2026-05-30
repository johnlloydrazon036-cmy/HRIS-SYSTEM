using HRIS.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HRIS.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EmployeeDocument> EmployeeDocuments => Set<EmployeeDocument>();

    public DbSet<Shift> Shifts => Set<Shift>();
    public DbSet<ShiftDay> ShiftDays => Set<ShiftDay>();

    public DbSet<EmployeeShiftAssignment> EmployeeShiftAssignments => Set<EmployeeShiftAssignment>();
    public DbSet<AttendanceLog> AttendanceLogs => Set<AttendanceLog>();

    public DbSet<OvertimeRequest> OvertimeRequests => Set<OvertimeRequest>();

    public DbSet<OvertimeRequestItem> OvertimeRequestItems => Set<OvertimeRequestItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.EmployeeNumber)
            .IsUnique();

        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.UserId)
            .IsUnique();

        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.SssNumber)
            .IsUnique();

        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.PhilHealthNumber)
            .IsUnique();

        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.PagIbigNumber)
            .IsUnique();

        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.TinNumber)
            .IsUnique();

        modelBuilder.Entity<Employee>()
            .HasOne(e => e.User)
            .WithOne(u => u.Employee)
            .HasForeignKey<Employee>(e => e.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}