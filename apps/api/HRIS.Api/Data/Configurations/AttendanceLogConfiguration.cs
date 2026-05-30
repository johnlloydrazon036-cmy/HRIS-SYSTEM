using HRIS.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRIS.Api.Data.Configurations;

public class AttendanceLogConfiguration : IEntityTypeConfiguration<AttendanceLog>
{
    public void Configure(EntityTypeBuilder<AttendanceLog> builder)
    {
        builder.ToTable("attendance_logs");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Date)
            .IsRequired();

        builder.Property(x => x.Task)
            .HasMaxLength(1000)
            .IsRequired(false);

        builder.Property(x => x.Accomplished)
            .HasMaxLength(1000)
            .IsRequired(false);

        builder.Property(x => x.LateMinutes)
            .HasDefaultValue(0);

        builder.Property(x => x.UndertimeMinutes)
            .HasDefaultValue(0);

        builder.Property(x => x.OvertimeMinutes)
            .HasDefaultValue(0);

        builder.Property(x => x.IsPresent)
            .HasDefaultValue(false);

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.HasOne(x => x.Employee)
            .WithMany()
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.EmployeeId, x.Date })
            .IsUnique();
    }
}