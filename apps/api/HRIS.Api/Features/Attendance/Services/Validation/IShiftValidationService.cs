using HRIS.Api.Features.Attendance.DTOs;

namespace HRIS.Api.Features.Attendance.Services.Validation;

public interface IShiftValidationService
{
    void ValidateShiftDays(IReadOnlyCollection<ShiftDayRequest> days);

    void ValidateShiftForAssignment(
        bool shiftIsActive,
        IReadOnlyCollection<ShiftDayRequest> days);
}