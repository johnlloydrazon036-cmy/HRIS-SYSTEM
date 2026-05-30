using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace HRIS.Api.Migrations
{
    /// <inheritdoc />
    public partial class Seed_Standard_Shift : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "shifts",
                columns: new[] { "Id", "Code", "CreatedAtUtc", "Description", "IsActive", "LateGraceMinutes", "Name", "UpdatedAtUtc" },
                values: new object[] { 1001, "STD-0830-1730", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Default weekday office shift", true, 5, "Standard Office Shift", null });

            migrationBuilder.InsertData(
                table: "shift_days",
                columns: new[] { "Id", "BreakEndTime", "BreakStartTime", "DayOfWeek", "EndTime", "IsWorkingDay", "ShiftId", "StartTime" },
                values: new object[,]
                {
                    { 2001, new TimeOnly(13, 0, 0), new TimeOnly(12, 0, 0), 1, new TimeOnly(17, 30, 0), true, 1001, new TimeOnly(8, 30, 0) },
                    { 2002, new TimeOnly(13, 0, 0), new TimeOnly(12, 0, 0), 2, new TimeOnly(17, 30, 0), true, 1001, new TimeOnly(8, 30, 0) },
                    { 2003, new TimeOnly(13, 0, 0), new TimeOnly(12, 0, 0), 3, new TimeOnly(17, 30, 0), true, 1001, new TimeOnly(8, 30, 0) },
                    { 2004, new TimeOnly(13, 0, 0), new TimeOnly(12, 0, 0), 4, new TimeOnly(17, 30, 0), true, 1001, new TimeOnly(8, 30, 0) },
                    { 2005, new TimeOnly(13, 0, 0), new TimeOnly(12, 0, 0), 5, new TimeOnly(17, 30, 0), true, 1001, new TimeOnly(8, 30, 0) },
                    { 2006, null, null, 6, null, false, 1001, null },
                    { 2007, null, null, 0, null, false, 1001, null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "shift_days",
                keyColumn: "Id",
                keyValue: 2001);

            migrationBuilder.DeleteData(
                table: "shift_days",
                keyColumn: "Id",
                keyValue: 2002);

            migrationBuilder.DeleteData(
                table: "shift_days",
                keyColumn: "Id",
                keyValue: 2003);

            migrationBuilder.DeleteData(
                table: "shift_days",
                keyColumn: "Id",
                keyValue: 2004);

            migrationBuilder.DeleteData(
                table: "shift_days",
                keyColumn: "Id",
                keyValue: 2005);

            migrationBuilder.DeleteData(
                table: "shift_days",
                keyColumn: "Id",
                keyValue: 2006);

            migrationBuilder.DeleteData(
                table: "shift_days",
                keyColumn: "Id",
                keyValue: 2007);

            migrationBuilder.DeleteData(
                table: "shifts",
                keyColumn: "Id",
                keyValue: 1001);
        }
    }
}
