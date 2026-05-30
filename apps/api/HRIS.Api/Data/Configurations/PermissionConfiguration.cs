using HRIS.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRIS.Api.Data.Configurations;

public class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> e)
    {
        e.ToTable("permissions");

        e.HasKey(p => p.Id);

        e.Property(p => p.Module)
            .HasMaxLength(50)
            .IsRequired();

        e.Property(p => p.CanView).IsRequired();
        e.Property(p => p.CanCreate).IsRequired();
        e.Property(p => p.CanUpdate).IsRequired();
        e.Property(p => p.CanArchive).IsRequired();

        e.Property(p => p.CreatedAt).IsRequired();
        e.Property(p => p.UpdatedAt);

        e.HasOne(p => p.Role)
            .WithMany()
            .HasForeignKey(p => p.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        e.HasIndex(p => new { p.RoleId, p.Module }).IsUnique();

        // DEFAULT PERMISSION SEED
        e.HasData(
            // SUPER_ADMIN
            new Permission
            {
                Id = 1,
                RoleId = 1,
                Module = "IAM",
                CanView = true,
                CanCreate = true,
                CanUpdate = true,
                CanArchive = true,
                CreatedAt = new DateTime(2026, 2, 23, 0, 0, 0, DateTimeKind.Utc)
            },
            new Permission
            {
                Id = 6,
                RoleId = 1,
                Module = "EMPLOYEES",
                CanView = true,
                CanCreate = true,
                CanUpdate = true,
                CanArchive = true,
                CreatedAt = new DateTime(2026, 2, 23, 0, 0, 0, DateTimeKind.Utc)
            },
            new Permission
            {
                Id = 9,
                RoleId = 1,
                Module = "ATTENDANCE",
                CanView = true,
                CanCreate = true,
                CanUpdate = true,
                CanArchive = true,
                CreatedAt = new DateTime(2026, 2, 23, 0, 0, 0, DateTimeKind.Utc)
            },

            // ADMIN
            new Permission
            {
                Id = 3,
                RoleId = 2,
                Module = "IAM",
                CanView = true,
                CanCreate = true,
                CanUpdate = true,
                CanArchive = true,
                CreatedAt = new DateTime(2026, 2, 23, 0, 0, 0, DateTimeKind.Utc)
            },
            new Permission
            {
                Id = 7,
                RoleId = 2,
                Module = "EMPLOYEES",
                CanView = true,
                CanCreate = true,
                CanUpdate = true,
                CanArchive = true,
                CreatedAt = new DateTime(2026, 2, 23, 0, 0, 0, DateTimeKind.Utc)
            },
            new Permission
            {
                Id = 10,
                RoleId = 2,
                Module = "ATTENDANCE",
                CanView = true,
                CanCreate = true,
                CanUpdate = true,
                CanArchive = true,
                CreatedAt = new DateTime(2026, 2, 23, 0, 0, 0, DateTimeKind.Utc)
            },

            // USER
            new Permission
            {
                Id = 8,
                RoleId = 3,
                Module = "EMPLOYEES",
                CanView = false,
                CanCreate = false,
                CanUpdate = false,
                CanArchive = false,
                CreatedAt = new DateTime(2026, 2, 23, 0, 0, 0, DateTimeKind.Utc)
            },
            new Permission
            {
                Id = 11,
                RoleId = 3,
                Module = "ATTENDANCE",
                CanView = false,
                CanCreate = false,
                CanUpdate = false,
                CanArchive = false,
                CreatedAt = new DateTime(2026, 2, 23, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}