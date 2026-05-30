using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRIS.Api.Migrations
{
    /// <inheritdoc />
    public partial class Add_Attendance_Permissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "permissions",
                columns: new[] { "Id", "CanArchive", "CanCreate", "CanUpdate", "CanView", "CreatedAt", "Module", "RoleId", "UpdatedAt" },
                values: new object[,]
                {
                    { 9, true, true, true, true, new DateTime(2026, 2, 23, 0, 0, 0, 0, DateTimeKind.Utc), "ATTENDANCE", 1, null },
                    { 10, true, true, true, true, new DateTime(2026, 2, 23, 0, 0, 0, 0, DateTimeKind.Utc), "ATTENDANCE", 2, null },
                    { 11, false, false, false, false, new DateTime(2026, 2, 23, 0, 0, 0, 0, DateTimeKind.Utc), "ATTENDANCE", 3, null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "permissions",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "permissions",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "permissions",
                keyColumn: "Id",
                keyValue: 11);
        }
    }
}