using HRIS.Api.Features.Attendance.DTOs;

namespace HRIS.Api.Features.Attendance.Services;

public interface IShiftsService
{
    Task<PagedShiftsResponse> GetShiftsAsync(GetShiftQuery query, CancellationToken ct);

    Task<ShiftDto?> GetByIdAsync(int id, CancellationToken ct);

    Task<ShiftDto> CreateAsync(CreateShiftRequest request, CancellationToken ct);

    Task<ShiftDto?> UpdateAsync(int id, UpdateShiftRequest request, CancellationToken ct);

    Task<bool> UpdateStatusAsync(int id, UpdateShiftStatusRequest request, CancellationToken ct);
}