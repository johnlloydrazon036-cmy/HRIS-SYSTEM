using HRIS.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRIS.Api.Data.Configurations;

public class OvertimeRequestItemConfiguration : IEntityTypeConfiguration<OvertimeRequestItem>
{
    public void Configure(EntityTypeBuilder<OvertimeRequestItem> builder)
    {
        builder.ToTable("overtime_request_items");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.OvertimeRequestId)
            .IsRequired();

        builder.Property(x => x.Date)
            .IsRequired();

        builder.Property(x => x.RequestedMinutes)
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.Property(x => x.UpdatedAtUtc);

        builder.HasOne(x => x.OvertimeRequest)
            .WithMany(x => x.Items)
            .HasForeignKey(x => x.OvertimeRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.AttendanceLog)
            .WithMany()
            .HasForeignKey(x => x.AttendanceLogId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.OvertimeRequestId);

        builder.HasIndex(x => x.Date);

        builder.HasIndex(x => x.AttendanceLogId);

        builder.HasIndex(x => new { x.OvertimeRequestId, x.Date })
            .IsUnique();
    }
}