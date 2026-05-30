using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRIS.Api.Migrations
{
    /// <inheritdoc />
    public partial class Upgrade_Overtime_To_V2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_overtime_requests_attendance_logs_AttendanceLogId",
                table: "overtime_requests");

            migrationBuilder.DropIndex(
                name: "IX_overtime_requests_AttendanceLogId",
                table: "overtime_requests");

            migrationBuilder.DropColumn(
                name: "AttendanceLogId",
                table: "overtime_requests");

            migrationBuilder.DropColumn(
                name: "RequestedMinutes",
                table: "overtime_requests");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "overtime_requests",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20,
                oldDefaultValue: "Pending")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "DateFrom",
                table: "overtime_requests",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<DateOnly>(
                name: "DateTo",
                table: "overtime_requests",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.CreateTable(
                name: "overtime_request_items",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    OvertimeRequestId = table.Column<int>(type: "int", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    RequestedMinutes = table.Column<int>(type: "int", nullable: false),
                    AttendanceLogId = table.Column<int>(type: "int", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_overtime_request_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_overtime_request_items_attendance_logs_AttendanceLogId",
                        column: x => x.AttendanceLogId,
                        principalTable: "attendance_logs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_overtime_request_items_overtime_requests_OvertimeRequestId",
                        column: x => x.OvertimeRequestId,
                        principalTable: "overtime_requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_overtime_requests_EmployeeId_DateFrom_DateTo",
                table: "overtime_requests",
                columns: new[] { "EmployeeId", "DateFrom", "DateTo" });

            migrationBuilder.CreateIndex(
                name: "IX_overtime_requests_Status",
                table: "overtime_requests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_overtime_request_items_AttendanceLogId",
                table: "overtime_request_items",
                column: "AttendanceLogId");

            migrationBuilder.CreateIndex(
                name: "IX_overtime_request_items_Date",
                table: "overtime_request_items",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_overtime_request_items_OvertimeRequestId",
                table: "overtime_request_items",
                column: "OvertimeRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_overtime_request_items_OvertimeRequestId_Date",
                table: "overtime_request_items",
                columns: new[] { "OvertimeRequestId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "overtime_request_items");

            migrationBuilder.DropIndex(
                name: "IX_overtime_requests_EmployeeId_DateFrom_DateTo",
                table: "overtime_requests");

            migrationBuilder.DropIndex(
                name: "IX_overtime_requests_Status",
                table: "overtime_requests");

            migrationBuilder.DropColumn(
                name: "DateFrom",
                table: "overtime_requests");

            migrationBuilder.DropColumn(
                name: "DateTo",
                table: "overtime_requests");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "overtime_requests",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Pending",
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "AttendanceLogId",
                table: "overtime_requests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RequestedMinutes",
                table: "overtime_requests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_overtime_requests_AttendanceLogId",
                table: "overtime_requests",
                column: "AttendanceLogId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_overtime_requests_attendance_logs_AttendanceLogId",
                table: "overtime_requests",
                column: "AttendanceLogId",
                principalTable: "attendance_logs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
