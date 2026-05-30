namespace HRIS.Api.Features.Employees.DTOs;

public class EmployeeDto
{
    public Guid Id { get; set; }

    public string EmployeeNumber { get; set; } = default!;

    public string FirstName { get; set; } = default!;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = default!;
    public string? Suffix { get; set; }

    public string FullName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; }
    public string? Sex { get; set; }
    public string? CivilStatus { get; set; }

    public DateOnly DateHired { get; set; }
    public string EmploymentType { get; set; } = default!;

    public string? Department { get; set; }
    public string? Position { get; set; }

    public string? ContactNumber { get; set; }
    public string? Email { get; set; }

    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? Province { get; set; }
    public string? ZipCode { get; set; }

    public string? SSSNumber { get; set; }
    public string? PhilHealthNumber { get; set; }
    public string? PagIbigNumber { get; set; }
    public string? TINNumber { get; set; }

    public bool IsActive { get; set; }
    public bool IsNewHire { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}