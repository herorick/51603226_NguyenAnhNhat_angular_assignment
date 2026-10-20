using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FamilyFinance.Api.Migrations
{
    /// <inheritdoc />
    public partial class F3AddExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BudgetAllocationId = table.Column<int>(type: "INTEGER", nullable: false),
                    ExpenseDate = table.Column<string>(type: "TEXT", nullable: false),
                    AmountVnd = table.Column<long>(type: "INTEGER", nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                    table.CheckConstraint("CK_Expenses_AmountVnd", "\"AmountVnd\" > 0");
                    table.ForeignKey(
                        name: "FK_Expenses_BudgetAllocations_BudgetAllocationId",
                        column: x => x.BudgetAllocationId,
                        principalTable: "BudgetAllocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_BudgetAllocationId_ExpenseDate",
                table: "Expenses",
                columns: new[] { "BudgetAllocationId", "ExpenseDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Expenses");
        }
    }
}
