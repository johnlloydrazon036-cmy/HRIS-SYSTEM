using HRIS.Api.Data;
using HRIS.Api.Features.Employees.DTOs;
using HRIS.Api.Features.IAM.Services;
using HRIS.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace HRIS.Api.Features.Employees.Services;

public class EmployeesService
{
    private readonly AppDbContext _db;
    private readonly IActivityLogger _activityLogger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public EmployeesService(
        AppDbContext db,
        IActivityLogger activityLogger,
        IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _activityLogger = activityLogger;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<PagedEmployeesResponse> GetAllAsync(GetEmployeesQuery query, CancellationToken ct = default)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 10 : query.PageSize;
        if (pageSize > 100) pageSize = 100;

        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var newHireCutoff = todayUtc.AddDays(-7);

        var baseQuery = _db.Employees
            .AsNoTracking()
            .Include(e => e.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();

            baseQuery = baseQuery.Where(e =>
                e.EmployeeNumber.Contains(search) ||
                e.FirstName.Contains(search) ||
                (e.MiddleName != null && e.MiddleName.Contains(search)) ||
                e.LastName.Contains(search) ||
                (e.User != null && e.User.Suffix != null && e.User.Suffix.Contains(search)) ||
                (e.Department != null && e.Department.Contains(search)) ||
                (e.Position != null && e.Position.Contains(search)) ||
                (e.EmploymentType != null && e.EmploymentType.Contains(search))
            );
        }

        var filteredQuery = baseQuery;

        if (!string.IsNullOrWhiteSpace(query.EmploymentType))
        {
            var normalizedEmploymentType = query.EmploymentType.Trim();

            if (normalizedEmploymentType.Equals("Project-based", StringComparison.OrdinalIgnoreCase))
            {
                normalizedEmploymentType = "Contract";
            }

            filteredQuery = filteredQuery.Where(e =>
                e.EmploymentType != null &&
                (
                    e.EmploymentType == normalizedEmploymentType ||
                    (
                        normalizedEmploymentType == "Contract" &&
                        e.EmploymentType == "Project-based"
                    )
                )
            );
        }

        if (query.IsNewHire == true)
        {
            filteredQuery = filteredQuery.Where(
                e => e.DateHired >= newHireCutoff && e.DateHired <= todayUtc);
        }
        else if (query.IsActive.HasValue)
        {
            filteredQuery = filteredQuery.Where(e => e.IsActive == query.IsActive.Value);
        }

        var totalCount = await filteredQuery.CountAsync(ct);

        EmployeeSummaryDto summary;

        if (query.IsNewHire == true)
        {
            summary = new EmployeeSummaryDto
            {
                Total = totalCount,
                Active = await filteredQuery.CountAsync(e => e.IsActive, ct),
                Inactive = await filteredQuery.CountAsync(e => !e.IsActive, ct),
                NewHires = totalCount
            };
        }
        else if (query.IsActive == true)
        {
            summary = new EmployeeSummaryDto
            {
                Total = totalCount,
                Active = totalCount,
                Inactive = 0,
                NewHires = await filteredQuery.CountAsync(
                    e => e.DateHired >= newHireCutoff && e.DateHired <= todayUtc,
                    ct)
            };
        }
        else if (query.IsActive == false)
        {
            summary = new EmployeeSummaryDto
            {
                Total = totalCount,
                Active = 0,
                Inactive = totalCount,
                NewHires = await filteredQuery.CountAsync(
                    e => e.DateHired >= newHireCutoff && e.DateHired <= todayUtc,
                    ct)
            };
        }
        else
        {
            summary = new EmployeeSummaryDto
            {
                Total = totalCount,
                Active = await filteredQuery.CountAsync(e => e.IsActive, ct),
                Inactive = await filteredQuery.CountAsync(e => !e.IsActive, ct),
                NewHires = await filteredQuery.CountAsync(
                    e => e.DateHired >= newHireCutoff && e.DateHired <= todayUtc,
                    ct)
            };
        }

        var skip = (page - 1) * pageSize;
        var sort = query.SortBy?.Trim().ToLowerInvariant();

        filteredQuery = sort switch
        {
            "oldest" => filteredQuery.OrderBy(e => e.CreatedAtUtc),
            "name" => filteredQuery.OrderBy(e => e.LastName).ThenBy(e => e.FirstName),
            _ => filteredQuery.OrderByDescending(e => e.CreatedAtUtc)
        };

        var items = await filteredQuery
            .Skip(skip)
            .Take(pageSize)
            .Select(ToDtoExpr())
            .ToListAsync(ct);

        return new PagedEmployeesResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Summary = summary
        };
    }

    public async Task<EmploymentTypeSummaryDto> GetEmploymentTypeSummaryAsync(CancellationToken ct = default)
    {
        var query = _db.Employees.AsNoTracking();

        var regular = await query.CountAsync(e => e.EmploymentType == "Regular", ct);
        var probationary = await query.CountAsync(e => e.EmploymentType == "Probationary", ct);
        var contract = await query.CountAsync(
            e => e.EmploymentType == "Contract" || e.EmploymentType == "Project-based",
            ct);

        return new EmploymentTypeSummaryDto
        {
            Regular = regular,
            Probationary = probationary,
            Contract = contract
        };
    }

    public async Task<EmployeeDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Employees
            .AsNoTracking()
            .Include(e => e.User)
            .Where(e => e.Id == id)
            .Select(ToDtoExpr())
            .FirstOrDefaultAsync(ct);
    }

    public async Task<List<EmployeeDocumentDto>> GetDocumentsAsync(
        Guid employeeId,
        CancellationToken ct = default)
    {
        return await _db.EmployeeDocuments
            .AsNoTracking()
            .Where(d => d.EmployeeId == employeeId)
            .OrderByDescending(d => d.UploadedAtUtc)
            .Select(d => new EmployeeDocumentDto(
                d.Id,
                d.DocumentType,
                d.OriginalFileName,
                d.ContentType,
                d.FileSize,
                d.UploadedAtUtc
            ))
            .ToListAsync(ct);
    }

    public async Task<(bool ok, string? error, (Stream Stream, string ContentType, string OriginalFileName)? file)>
        DownloadDocumentAsync(
            Guid employeeId,
            Guid documentId,
            CancellationToken ct = default)
    {
        var document = await _db.EmployeeDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId && d.EmployeeId == employeeId, ct);

        if (document is null)
            return (false, "Document not found.", null);

        var absolutePath = Path.Combine(Directory.GetCurrentDirectory(), document.StoragePath);

        if (!System.IO.File.Exists(absolutePath))
            return (false, "File not found on server.", null);

        var stream = new FileStream(absolutePath, FileMode.Open, FileAccess.Read, FileShare.Read);

        return (true, null, (stream, document.ContentType, document.OriginalFileName));
    }

    public async Task<(bool ok, string? error)> DeleteDocumentAsync(
        Guid employeeId,
        Guid documentId,
        CancellationToken ct = default)
    {
        var document = await _db.EmployeeDocuments
            .FirstOrDefaultAsync(d => d.Id == documentId && d.EmployeeId == employeeId, ct);

        if (document is null)
            return (false, "Document not found.");

        var absolutePath = Path.Combine(Directory.GetCurrentDirectory(), document.StoragePath);

        _db.EmployeeDocuments.Remove(document);
        await _db.SaveChangesAsync(ct);

        if (System.IO.File.Exists(absolutePath))
        {
            System.IO.File.Delete(absolutePath);
        }

        return (true, null);
    }

    public async Task<NextEmployeeNumberResponse> GetNextEmployeeNumberAsync(CancellationToken ct = default)
    {
        var nextEmployeeNumber = await GenerateNextEmployeeNumberAsync(ct);
        return new NextEmployeeNumberResponse(nextEmployeeNumber);
    }

    public async Task<(bool ok, string? error, EmployeeDto? employee)> CreateAsync(
        CreateEmployeeRequest req,
        CancellationToken ct = default)
    {
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == req.UserId, ct);

        if (user is null)
            return (false, "Selected user not found.", null);

        if (!user.IsActive)
            return (false, "Selected user is inactive.", null);

        if (user.RoleId != 3)
            return (false, "Only user accounts can be linked as employees.", null);

        var alreadyLinked = await _db.Employees.AnyAsync(e => e.UserId == req.UserId, ct);
        if (alreadyLinked)
            return (false, "This user is already linked to an employee.", null);

        var firstName = string.IsNullOrWhiteSpace(user.FirstName)
            ? ExtractFirstName(user.FullName)
            : user.FirstName!.Trim();

        var middleName = string.IsNullOrWhiteSpace(user.MiddleName)
            ? null
            : user.MiddleName.Trim();

        var lastName = string.IsNullOrWhiteSpace(user.LastName)
            ? ExtractLastName(user.FullName)
            : user.LastName!.Trim();

        const int maxEmployeeNumberAttempts = 3;

        for (var attempt = 1; attempt <= maxEmployeeNumberAttempts; attempt++)
        {
            var nextEmployeeNumber = await GenerateNextEmployeeNumberAsync(ct);

            var entity = new Employee
            {
                Id = Guid.NewGuid(),
                UserId = req.UserId,
                EmployeeNumber = nextEmployeeNumber,

                FirstName = firstName,
                MiddleName = middleName,
                LastName = lastName,

                DateHired = DateOnly.FromDateTime(DateTime.UtcNow),
                EmploymentType = req.EmploymentType.Trim(),

                Department = string.IsNullOrWhiteSpace(req.Department) ? null : req.Department.Trim(),
                Position = string.IsNullOrWhiteSpace(req.Position) ? null : req.Position.Trim(),

                ContactNumber = string.IsNullOrWhiteSpace(req.ContactNumber) ? null : req.ContactNumber.Trim(),
                Email = string.IsNullOrWhiteSpace(user.Email) ? null : user.Email.Trim(),

                AddressLine1 = string.IsNullOrWhiteSpace(req.AddressLine1) ? null : req.AddressLine1.Trim(),
                AddressLine2 = string.IsNullOrWhiteSpace(req.AddressLine2) ? null : req.AddressLine2.Trim(),
                City = string.IsNullOrWhiteSpace(req.City) ? null : req.City.Trim(),
                Province = string.IsNullOrWhiteSpace(req.Province) ? null : req.Province.Trim(),
                ZipCode = string.IsNullOrWhiteSpace(req.ZipCode) ? null : req.ZipCode.Trim(),

                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            };

            _db.Employees.Add(entity);

            try
            {
                await _db.SaveChangesAsync(ct);

                var httpContext = _httpContextAccessor.HttpContext;

                if (httpContext is not null)
                {
                    var log = _activityLogger.Build(
                        user: httpContext.User,
                        action: "EMPLOYEE_CREATED",
                        module: "EMPLOYEES",
                        targetType: "Employee",
                        targetId: entity.Id.ToString(),
                        summary: $"Created employee {entity.EmployeeNumber} ({BuildDisplayName(entity.FirstName, entity.MiddleName, entity.LastName, user.Suffix)})",
                        ipAddress: httpContext.Connection.RemoteIpAddress?.ToString(),
                        userAgent: httpContext.Request.Headers["User-Agent"].ToString()
                    );

                    if (log is not null)
                    {
                        _db.ActivityLogs.Add(log);
                        await _db.SaveChangesAsync(ct);
                    }
                }

                entity.User = user;
                return (true, null, ToDto(entity));
            }
            catch (DbUpdateException ex) when (IsEmployeeNumberUniqueConflict(ex) && attempt < maxEmployeeNumberAttempts)
            {
                _db.Entry(entity).State = EntityState.Detached;
            }
        }

        return (false, "Unable to generate a unique employee number. Please try again.", null);
    }

    public async Task<(bool ok, string? error, EmployeeDocument? document)> UploadDocumentAsync(
        Guid employeeId,
        string? documentType,
        IFormFile? file,
        CancellationToken ct = default)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == employeeId, ct);
        if (employee is null)
            return (false, "Employee not found.", null);

        if (string.IsNullOrWhiteSpace(documentType))
            return (false, "Document type is required.", null);

        if (file is null || file.Length == 0)
            return (false, "File is required.", null);

        var normalizedDocumentType = documentType.Trim();
        var originalFileName = Path.GetFileName(file.FileName);

        if (string.IsNullOrWhiteSpace(originalFileName))
            return (false, "Invalid file name.", null);

        var relativeDirectory = Path.Combine("uploads", "employees", employeeId.ToString());
        var absoluteDirectory = Path.Combine(Directory.GetCurrentDirectory(), relativeDirectory);

        if (!Directory.Exists(absoluteDirectory))
        {
            Directory.CreateDirectory(absoluteDirectory);
        }

        var extension = Path.GetExtension(originalFileName);
        var storedFileName = $"{Guid.NewGuid()}{extension}";
        var absoluteFilePath = Path.Combine(absoluteDirectory, storedFileName);
        var relativeFilePath = Path.Combine(relativeDirectory, storedFileName).Replace("\\", "/");

        await using (var stream = new FileStream(absoluteFilePath, FileMode.Create))
        {
            await file.CopyToAsync(stream, ct);
        }

        var document = new EmployeeDocument
        {
            Id = Guid.NewGuid(),
            EmployeeId = employeeId,
            DocumentType = normalizedDocumentType,
            OriginalFileName = originalFileName,
            StoredFileName = storedFileName,
            ContentType = string.IsNullOrWhiteSpace(file.ContentType)
                ? "application/octet-stream"
                : file.ContentType,
            FileSize = file.Length,
            StoragePath = relativeFilePath,
            UploadedAtUtc = DateTime.UtcNow
        };

        _db.EmployeeDocuments.Add(document);
        await _db.SaveChangesAsync(ct);

        return (true, null, document);
    }

    public async Task<(bool ok, string? error, EmployeeDto? employee)> UpdateAsync(
        Guid id,
        UpdateEmployeeRequest req,
        CancellationToken ct = default)
    {
        var entity = await _db.Employees
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id, ct);
        if (entity is null) return (false, "Employee not found.", null);

        var firstName = req.FirstName.Trim();
        var middleName = string.IsNullOrWhiteSpace(req.MiddleName) ? null : req.MiddleName.Trim();
        var lastName = req.LastName.Trim();

        var sex = string.IsNullOrWhiteSpace(req.Sex) ? null : req.Sex.Trim();
        var civilStatus = string.IsNullOrWhiteSpace(req.CivilStatus) ? null : req.CivilStatus.Trim();

        var department = string.IsNullOrWhiteSpace(req.Department) ? null : req.Department.Trim();
        var position = string.IsNullOrWhiteSpace(req.Position) ? null : req.Position.Trim();
        var employmentType = req.EmploymentType.Trim();

        var contactNumber = string.IsNullOrWhiteSpace(req.ContactNumber) ? null : req.ContactNumber.Trim();
        var email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();

        var addressLine1 = string.IsNullOrWhiteSpace(req.AddressLine1) ? null : req.AddressLine1.Trim();
        var addressLine2 = string.IsNullOrWhiteSpace(req.AddressLine2) ? null : req.AddressLine2.Trim();
        var city = string.IsNullOrWhiteSpace(req.City) ? null : req.City.Trim();
        var province = string.IsNullOrWhiteSpace(req.Province) ? null : req.Province.Trim();
        var zipCode = string.IsNullOrWhiteSpace(req.ZipCode) ? null : req.ZipCode.Trim();

        var sssNumber = NormalizeGovernmentValue(req.SSSNumber);
        var philHealthNumber = NormalizeGovernmentValue(req.PhilHealthNumber);
        var pagIbigNumber = NormalizeGovernmentValue(req.PagIbigNumber);
        var tinNumber = NormalizeGovernmentValue(req.TINNumber);

        var duplicateErrors = new List<string>();

        if (!string.IsNullOrWhiteSpace(sssNumber))
        {
            var candidates = BuildGovernmentCandidates(sssNumber, GovernmentNumberKind.Sss);

            var exists = await _db.Employees.AnyAsync(
                e => e.Id != id &&
                    e.SssNumber != null &&
                    candidates.Contains(e.SssNumber),
                ct);

            if (exists)
                duplicateErrors.Add("sssNumber:SSS number already exists.");
        }

        if (!string.IsNullOrWhiteSpace(philHealthNumber))
        {
            var candidates = BuildGovernmentCandidates(philHealthNumber, GovernmentNumberKind.PhilHealth);

            var exists = await _db.Employees.AnyAsync(
                e => e.Id != id &&
                    e.PhilHealthNumber != null &&
                    candidates.Contains(e.PhilHealthNumber),
                ct);

            if (exists)
                duplicateErrors.Add("philHealthNumber:PhilHealth number already exists.");
        }

        if (!string.IsNullOrWhiteSpace(pagIbigNumber))
        {
            var candidates = BuildGovernmentCandidates(pagIbigNumber, GovernmentNumberKind.PagIbig);

            var exists = await _db.Employees.AnyAsync(
                e => e.Id != id &&
                    e.PagIbigNumber != null &&
                    candidates.Contains(e.PagIbigNumber),
                ct);

            if (exists)
                duplicateErrors.Add("pagIbigNumber:Pag-IBIG number already exists.");
        }

        if (!string.IsNullOrWhiteSpace(tinNumber))
        {
            var candidates = BuildGovernmentCandidates(tinNumber, GovernmentNumberKind.Tin);

            var exists = await _db.Employees.AnyAsync(
                e => e.Id != id &&
                    e.TinNumber != null &&
                    candidates.Contains(e.TinNumber),
                ct);

            if (exists)
                duplicateErrors.Add("tinNumber:TIN already exists.");
        }

        if (duplicateErrors.Count > 0)
            return (false, string.Join("|", duplicateErrors), null);

        var previousIsActive = entity.IsActive;

        entity.FirstName = firstName;
        entity.MiddleName = middleName;
        entity.LastName = lastName;

        entity.BirthDate = req.BirthDate;
        entity.Sex = sex;
        entity.CivilStatus = civilStatus;

        entity.Department = department;
        entity.Position = position;
        entity.EmploymentType = employmentType;

        entity.ContactNumber = contactNumber;
        entity.Email = email;

        entity.AddressLine1 = addressLine1;
        entity.AddressLine2 = addressLine2;
        entity.City = city;
        entity.Province = province;
        entity.ZipCode = zipCode;

        entity.SssNumber = sssNumber;
        entity.PhilHealthNumber = philHealthNumber;
        entity.PagIbigNumber = pagIbigNumber;
        entity.TinNumber = tinNumber;

        entity.IsActive = req.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        var httpContext = _httpContextAccessor.HttpContext;

        if (httpContext is not null)
        {
            var fullName = BuildDisplayName(
                entity.FirstName,
                entity.MiddleName,
                entity.LastName,
                entity.User?.Suffix);

            var statusChanged = previousIsActive != entity.IsActive;

            var action = statusChanged
                ? "EMPLOYEE_STATUS_UPDATED"
                : "EMPLOYEE_UPDATED";

            var summary = statusChanged
                ? $"Updated employee status {entity.EmployeeNumber} ({fullName}) -> {(entity.IsActive ? "Active" : "Inactive")}"
                : $"Updated employee {entity.EmployeeNumber} ({fullName})";

            var log = _activityLogger.Build(
                user: httpContext.User,
                action: action,
                module: "EMPLOYEES",
                targetType: "Employee",
                targetId: entity.Id.ToString(),
                summary: summary,
                ipAddress: httpContext.Connection.RemoteIpAddress?.ToString(),
                userAgent: httpContext.Request.Headers["User-Agent"].ToString()
            );

            if (log is not null)
            {
                _db.ActivityLogs.Add(log);
                await _db.SaveChangesAsync(ct);
            }
        }

        return (true, null, ToDto(entity));
    }

    public async Task<(bool ok, string? error, EmployeeDto? employee)> UpdateStatusAsync(
        Guid id,
        UpdateEmployeeStatusRequest req,
        CancellationToken ct = default)
    {
        var entity = await _db.Employees
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id, ct);
        if (entity is null) return (false, "Employee not found.", null);

        entity.IsActive = req.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        var httpContext = _httpContextAccessor.HttpContext;

        if (httpContext is not null)
        {
            var fullName = BuildDisplayName(
                entity.FirstName,
                entity.MiddleName,
                entity.LastName,
                entity.User?.Suffix);

            var statusLabel = entity.IsActive ? "Active" : "Inactive";

            var log = _activityLogger.Build(
                user: httpContext.User,
                action: "EMPLOYEE_STATUS_UPDATED",
                module: "EMPLOYEES",
                targetType: "Employee",
                targetId: entity.Id.ToString(),
                summary: $"Updated employee status {entity.EmployeeNumber} ({fullName}) -> {statusLabel}",
                ipAddress: httpContext.Connection.RemoteIpAddress?.ToString(),
                userAgent: httpContext.Request.Headers["User-Agent"].ToString()
            );

            if (log is not null)
            {
                _db.ActivityLogs.Add(log);
                await _db.SaveChangesAsync(ct);
            }
        }

        return (true, null, ToDto(entity));
    }

    public async Task<(bool ok, string? error)> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (entity is null) return (false, "Employee not found.");

        if (!entity.IsActive)
            return (true, null);

        entity.IsActive = false;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    private async Task<string> GenerateNextEmployeeNumberAsync(CancellationToken ct)
    {
        var existingNumbers = await _db.Employees
            .AsNoTracking()
            .Select(e => e.EmployeeNumber)
            .ToListAsync(ct);

        var max = 0;

        foreach (var number in existingNumbers)
        {
            if (string.IsNullOrWhiteSpace(number)) continue;

            var normalized = number.Trim();

            if (!normalized.StartsWith("EMP-", StringComparison.OrdinalIgnoreCase))
                continue;

            var suffix = normalized.Substring(4);

            if (int.TryParse(suffix, out var parsed) && parsed > max)
            {
                max = parsed;
            }
        }

        return $"EMP-{(max + 1):D3}";
    }

    private static bool IsEmployeeNumberUniqueConflict(DbUpdateException ex)
    {
        var message = $"{ex.Message} {ex.InnerException?.Message}".ToLowerInvariant();

        return
            (message.Contains("duplicate") || message.Contains("unique")) &&
            (message.Contains("employeenumber") || message.Contains("employee_number"));
    }

    private static string? NormalizeGovernmentValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var digits = new string(value.Where(char.IsDigit).ToArray());
        return string.IsNullOrWhiteSpace(digits) ? null : digits;
    }

    private static List<string> BuildGovernmentCandidates(string digitsOnly, GovernmentNumberKind kind)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            digitsOnly
        };

        switch (kind)
        {
            case GovernmentNumberKind.Sss:
                if (digitsOnly.Length == 10)
                    set.Add($"{digitsOnly[..2]}-{digitsOnly.Substring(2, 7)}-{digitsOnly.Substring(9, 1)}");
                break;

            case GovernmentNumberKind.PhilHealth:
                if (digitsOnly.Length == 12)
                    set.Add($"{digitsOnly[..2]}-{digitsOnly.Substring(2, 9)}-{digitsOnly.Substring(11, 1)}");
                break;

            case GovernmentNumberKind.PagIbig:
                if (digitsOnly.Length == 12)
                    set.Add($"{digitsOnly[..4]}-{digitsOnly.Substring(4, 4)}-{digitsOnly.Substring(8, 4)}");
                break;

            case GovernmentNumberKind.Tin:
                if (digitsOnly.Length == 9)
                    set.Add($"{digitsOnly[..3]}-{digitsOnly.Substring(3, 3)}-{digitsOnly.Substring(6, 3)}");
                break;
        }

        return set.ToList();
    }

    private static string ExtractFirstName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return "Unknown";

        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[0] : "Unknown";
    }

    private static string ExtractLastName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return "Unknown";

        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 1 ? parts[^1] : "Unknown";
    }

    private static string? NormalizeNamePart(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? GetMiddleInitial(string? middleName)
    {
        var normalized = NormalizeNamePart(middleName);
        if (string.IsNullOrWhiteSpace(normalized)) return null;

        return $"{char.ToUpperInvariant(normalized[0])}.";
    }

    private static string BuildDisplayName(
        string? firstName,
        string? middleName,
        string? lastName,
        string? suffix)
    {
        var normalizedFirstName = NormalizeNamePart(firstName);
        var normalizedLastName = NormalizeNamePart(lastName);
        var normalizedSuffix = NormalizeNamePart(suffix);
        var middleInitial = GetMiddleInitial(middleName);

        var givenNameParts = new[]
        {
            normalizedFirstName,
            middleInitial
        }.Where(x => !string.IsNullOrWhiteSpace(x));

        var givenName = string.Join(" ", givenNameParts);

        var displayName = string.IsNullOrWhiteSpace(normalizedLastName)
            ? givenName
            : string.IsNullOrWhiteSpace(givenName)
                ? normalizedLastName
                : $"{normalizedLastName}, {givenName}";

        if (!string.IsNullOrWhiteSpace(normalizedSuffix))
            displayName = string.IsNullOrWhiteSpace(displayName)
                ? normalizedSuffix
                : $"{displayName}, {normalizedSuffix}";

        return string.IsNullOrWhiteSpace(displayName) ? "Unknown Employee" : displayName;
    }

    private static EmployeeDto ToDto(Employee e)
    {
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var newHireCutoff = todayUtc.AddDays(-7);

        var firstName = e.User != null ? e.User.FirstName ?? e.FirstName : e.FirstName;
        var middleName = e.User != null ? e.User.MiddleName : e.MiddleName;
        var lastName = e.User != null ? e.User.LastName ?? e.LastName : e.LastName;
        var suffix = e.User != null ? e.User.Suffix : null;

        return new EmployeeDto
        {
            Id = e.Id,
            EmployeeNumber = e.EmployeeNumber,
            FirstName = firstName,
            MiddleName = middleName,
            LastName = lastName,
            Suffix = suffix,
            FullName = BuildDisplayName(firstName, middleName, lastName, suffix),

            BirthDate = e.BirthDate,
            Sex = e.Sex,
            CivilStatus = e.CivilStatus,

            DateHired = e.DateHired,
            EmploymentType = e.EmploymentType,

            Department = e.Department,
            Position = e.Position,

            ContactNumber = e.ContactNumber,
            Email = e.User != null ? e.User.Email : e.Email,

            AddressLine1 = e.AddressLine1,
            AddressLine2 = e.AddressLine2,
            City = e.City,
            Province = e.Province,
            ZipCode = e.ZipCode,

            SSSNumber = e.SssNumber,
            PhilHealthNumber = e.PhilHealthNumber,
            PagIbigNumber = e.PagIbigNumber,
            TINNumber = e.TinNumber,

            IsActive = e.IsActive,
            IsNewHire = e.DateHired >= newHireCutoff && e.DateHired <= todayUtc,
            CreatedAtUtc = e.CreatedAtUtc,
            UpdatedAtUtc = e.UpdatedAtUtc
        };
    }

    private static Expression<Func<Employee, EmployeeDto>> ToDtoExpr()
    {
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var newHireCutoff = todayUtc.AddDays(-7);

        return e => new EmployeeDto
        {
            Id = e.Id,
            EmployeeNumber = e.EmployeeNumber,
            FirstName = e.User != null ? (e.User.FirstName ?? e.FirstName) : e.FirstName,
            MiddleName = e.User != null ? e.User.MiddleName : e.MiddleName,
            LastName = e.User != null ? (e.User.LastName ?? e.LastName) : e.LastName,
            Suffix = e.User != null ? e.User.Suffix : null,
            FullName =
                (
                    string.IsNullOrWhiteSpace(e.User != null ? (e.User.LastName ?? e.LastName) : e.LastName)
                        ? ""
                        : (e.User != null ? (e.User.LastName ?? e.LastName) : e.LastName) + ", "
                ) +
                (e.User != null ? (e.User.FirstName ?? e.FirstName) : e.FirstName) +
                (
                    string.IsNullOrWhiteSpace(e.User != null ? e.User.MiddleName : e.MiddleName)
                        ? ""
                        : " " + (e.User != null ? e.User.MiddleName : e.MiddleName)!.Substring(0, 1).ToUpper() + "."
                ) +
                (
                    string.IsNullOrWhiteSpace(e.User != null ? e.User.Suffix : null)
                        ? ""
                        : ", " + (e.User != null ? e.User.Suffix : null)
                ),

            BirthDate = e.BirthDate,
            Sex = e.Sex,
            CivilStatus = e.CivilStatus,

            DateHired = e.DateHired,
            EmploymentType = e.EmploymentType,

            Department = e.Department,
            Position = e.Position,

            ContactNumber = e.ContactNumber,
            Email = e.User != null ? e.User.Email : e.Email,

            AddressLine1 = e.AddressLine1,
            AddressLine2 = e.AddressLine2,
            City = e.City,
            Province = e.Province,
            ZipCode = e.ZipCode,

            SSSNumber = e.SssNumber,
            PhilHealthNumber = e.PhilHealthNumber,
            PagIbigNumber = e.PagIbigNumber,
            TINNumber = e.TinNumber,

            IsActive = e.IsActive,
            IsNewHire = e.DateHired >= newHireCutoff && e.DateHired <= todayUtc,
            CreatedAtUtc = e.CreatedAtUtc,
            UpdatedAtUtc = e.UpdatedAtUtc
        };
    }

    private enum GovernmentNumberKind
    {
        Sss,
        PhilHealth,
        PagIbig,
        Tin
    }
}