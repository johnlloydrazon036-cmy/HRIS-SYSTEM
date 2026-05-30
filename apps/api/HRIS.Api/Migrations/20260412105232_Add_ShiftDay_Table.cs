using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRIS.Api.Migrations
{
    /// <inheritdoc />
    public partial class Add_ShiftDay_Table : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BreakEnd",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "BreakStart",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "RequiredHours",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "shifts");

            migrationBuilder.RenameColumn(
                name: "WorkingDays",
                table: "shifts",
                newName: "Code");

            migrationBuilder.RenameColumn(
                name: "GraceMinutes",
                table: "shifts",
                newName: "LateGraceMinutes");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "shifts",
                newName: "CreatedAtUtc");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "shifts",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "IsFlexible",
                table: "shifts",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAtUtc",
                table: "shifts",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "shift_days",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ShiftId = table.Column<int>(type: "int", nullable: false),
                    DayOfWeek = table.Column<int>(type: "int", nullable: false),
                    IsWorkingDay = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time(6)", nullable: true),
                    BreakStartTime = table.Column<TimeOnly>(type: "time(6)", nullable: true),
                    BreakEndTime = table.Column<TimeOnly>(type: "time(6)", nullable: true),
                    EndTime = table.Column<TimeOnly>(type: "time(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shift_days", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shift_days_shifts_ShiftId",
                        column: x => x.ShiftId,
                        principalTable: "shifts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_shifts_Code",
                table: "shifts",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_shift_days_ShiftId_DayOfWeek",
                table: "shift_days",
                columns: new[] { "ShiftId", "DayOfWeek" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "shift_days");

            migrationBuilder.DropIndex(
                name: "IX_shifts_Code",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "IsFlexible",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                table: "shifts");

            migrationBuilder.RenameColumn(
                name: "LateGraceMinutes",
                table: "shifts",
                newName: "GraceMinutes");

            migrationBuilder.RenameColumn(
                name: "CreatedAtUtc",
                table: "shifts",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "Code",
                table: "shifts",
                newName: "WorkingDays");

            migrationBuilder.AddColumn<TimeOnly>(
                name: "BreakEnd",
                table: "shifts",
                type: "time(6)",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "BreakStart",
                table: "shifts",
                type: "time(6)",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "EndTime",
                table: "shifts",
                type: "time(6)",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));

            migrationBuilder.AddColumn<decimal>(
                name: "RequiredHours",
                table: "shifts",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "StartTime",
                table: "shifts",
                type: "time(6)",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));
        }
    }
}
