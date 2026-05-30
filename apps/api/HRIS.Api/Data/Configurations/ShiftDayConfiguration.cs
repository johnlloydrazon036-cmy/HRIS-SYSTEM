using HRIS.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRIS.Api.Data.Configurations;

public class ShiftDayConfiguration : IEntityTypeConfiguration<ShiftDay>
{
    public void Configure(EntityTypeBuilder<ShiftDay> builder)
    {
        builder.ToTable("shift_days");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.DayOfWeek)
            .IsRequired()
            .HasConversion<int>();

        builder.Property(x => x.IsWorkingDay)
            .IsRequired();

        builder.Property(x => x.StartTime);

        builder.Property(x => x.BreakStartTime);

        builder.Property(x => x.BreakEndTime);

        builder.Property(x => x.EndTime);

        builder.HasIndex(x => new { x.ShiftId, x.DayOfWeek })
            .IsUnique();

        builder.HasOne(x => x.Shift)
            .WithMany(x => x.ShiftDays)
            .HasForeignKey(x => x.ShiftId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasData(
            new ShiftDay
            {
                Id = 2001,
                ShiftId = 1001,
                DayOfWeek = DayOfWeek.Monday,
                IsWorkingDay = true,
                StartTime = new TimeOnly(8, 30),
                BreakStartTime = new TimeOnly(12, 0),
                BreakEndTime = new TimeOnly(13, 0),
                EndTime = new TimeOnly(17, 30)
            },
            new ShiftDay
            {
                Id = 2002,
                ShiftId = 1001,
                DayOfWeek = DayOfWeek.Tuesday,
                IsWorkingDay = true,
                StartTime = new TimeOnly(8, 30),
                BreakStartTime = new TimeOnly(12, 0),
                BreakEndTime = new TimeOnly(13, 0),
                EndTime = new TimeOnly(17, 30)
            },
            new ShiftDay
            {
                Id = 2003,
                ShiftId = 1001,
                DayOfWeek = DayOfWeek.Wednesday,
                IsWorkingDay = true,
                StartTime = new TimeOnly(8, 30),
                BreakStartTime = new TimeOnly(12, 0),
                BreakEndTime = new TimeOnly(13, 0),
                EndTime = new TimeOnly(17, 30)
            },
            new ShiftDay
            {
                Id = 2004,
                ShiftId = 1001,
                DayOfWeek = DayOfWeek.Thursday,
                IsWorkingDay = true,
                StartTime = new TimeOnly(8, 30),
                BreakStartTime = new TimeOnly(12, 0),
                BreakEndTime = new TimeOnly(13, 0),
                EndTime = new TimeOnly(17, 30)
            },
            new ShiftDay
            {
                Id = 2005,
                ShiftId = 1001,
                DayOfWeek = DayOfWeek.Friday,
                IsWorkingDay = true,
                StartTime = new TimeOnly(8, 30),
                BreakStartTime = new TimeOnly(12, 0),
                BreakEndTime = new TimeOnly(13, 0),
                EndTime = new TimeOnly(17, 30)
            },
            new ShiftDay
            {
                Id = 2006,
                ShiftId = 1001,
                DayOfWeek = DayOfWeek.Saturday,
                IsWorkingDay = false,
                StartTime = null,
                BreakStartTime = null,
                BreakEndTime = null,
                EndTime = null
            },
            new ShiftDay
            {
                Id = 2007,
                ShiftId = 1001,
                DayOfWeek = DayOfWeek.Sunday,
                IsWorkingDay = false,
                StartTime = null,
                BreakStartTime = null,
                BreakEndTime = null,
                EndTime = null
            }
        );
    }
}