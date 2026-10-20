using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FamilyFinance.Api.Migrations;

public partial class F1MonthlyPlanning : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TEMP TABLE "__F1MigrationGuard" (
                "Legacy_data_must_be_integral_VND_and_match_F1_jars" INTEGER NOT NULL
                    CHECK ("Legacy_data_must_be_integral_VND_and_match_F1_jars" = 1)
            );

            INSERT INTO "__F1MigrationGuard"
            SELECT CASE WHEN
                NOT EXISTS (
                    SELECT 1 FROM "BudgetPlans" p
                    WHERE p."Year" NOT BETWEEN 1 AND 9999
                       OR p."Month" NOT BETWEEN 1 AND 12
                       OR CAST(p."MonthlyIncome" AS NUMERIC) <= 0
                       OR CAST(p."MonthlyIncome" AS NUMERIC) <> CAST(p."MonthlyIncome" AS INTEGER)
                       OR CAST(p."MonthlyIncome" AS TEXT) GLOB '*[^0-9.]*'
                       OR LENGTH(CAST(p."MonthlyIncome" AS TEXT)) - LENGTH(REPLACE(CAST(p."MonthlyIncome" AS TEXT), '.', '')) > 1
                       OR SUBSTR(CAST(p."MonthlyIncome" AS TEXT), 1, 1) = '.'
                       OR SUBSTR(CAST(p."MonthlyIncome" AS TEXT), -1, 1) = '.'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "BudgetAllocations" a
                    WHERE CAST(a."Percentage" AS NUMERIC) <> CAST(a."Percentage" AS INTEGER)
                       OR CAST(a."Amount" AS NUMERIC) < 0
                       OR CAST(a."Amount" AS NUMERIC) <> CAST(a."Amount" AS INTEGER)
                       OR CAST(a."Amount" AS TEXT) GLOB '*[^0-9.]*'
                       OR LENGTH(CAST(a."Amount" AS TEXT)) - LENGTH(REPLACE(CAST(a."Amount" AS TEXT), '.', '')) > 1
                       OR SUBSTR(CAST(a."Amount" AS TEXT), 1, 1) = '.'
                       OR SUBSTR(CAST(a."Amount" AS TEXT), -1, 1) = '.'
                       OR NOT (
                            (a."JarType" = 'livingExpenses' AND CAST(a."Percentage" AS NUMERIC) = 35) OR
                            (a."JarType" = 'food' AND CAST(a."Percentage" AS NUMERIC) = 20) OR
                            (a."JarType" = 'children' AND CAST(a."Percentage" AS NUMERIC) = 10) OR
                            (a."JarType" = 'emergencyFund' AND CAST(a."Percentage" AS NUMERIC) = 10) OR
                            (a."JarType" = 'savings' AND CAST(a."Percentage" AS NUMERIC) = 10) OR
                            (a."JarType" = 'investment' AND CAST(a."Percentage" AS NUMERIC) = 10) OR
                            (a."JarType" = 'entertainmentAndTravel' AND CAST(a."Percentage" AS NUMERIC) = 5)
                       )
                )
                AND NOT EXISTS (
                    SELECT p."Id"
                    FROM "BudgetPlans" p
                    LEFT JOIN "BudgetAllocations" a ON a."BudgetPlanId" = p."Id"
                    GROUP BY p."Id"
                    HAVING COUNT(a."Id") <> 7
                        OR COUNT(DISTINCT a."JarType") <> 7
                        OR SUM(CAST(a."Amount" AS INTEGER)) <> CAST(p."MonthlyIncome" AS INTEGER)
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "BudgetAllocations" a
                    LEFT JOIN "BudgetPlans" p ON p."Id" = a."BudgetPlanId"
                    WHERE p."Id" IS NULL
                )
            THEN 1 ELSE 0 END;

            DROP TABLE "__F1MigrationGuard";

            CREATE TABLE "BudgetPlans_F1" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_BudgetPlans_F1" PRIMARY KEY AUTOINCREMENT,
                "Year" INTEGER NOT NULL CHECK ("Year" BETWEEN 1 AND 9999),
                "Month" INTEGER NOT NULL CHECK ("Month" BETWEEN 1 AND 12),
                "MonthlyIncomeVnd" INTEGER NOT NULL CHECK ("MonthlyIncomeVnd" > 0),
                "CreatedAtUtc" TEXT NOT NULL
            );

            CREATE TABLE "BudgetAllocations_F1" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_BudgetAllocations_F1" PRIMARY KEY AUTOINCREMENT,
                "BudgetPlanId" INTEGER NOT NULL,
                "JarType" TEXT NOT NULL CHECK ("JarType" IN ('livingExpenses', 'food', 'children', 'emergencyFund', 'savings', 'investment', 'entertainmentAndTravel')),
                "PercentagePoints" INTEGER NOT NULL CHECK ("PercentagePoints" BETWEEN 0 AND 100),
                "BudgetVnd" INTEGER NOT NULL CHECK ("BudgetVnd" >= 0),
                CONSTRAINT "FK_BudgetAllocations_F1_BudgetPlans_F1_BudgetPlanId" FOREIGN KEY ("BudgetPlanId") REFERENCES "BudgetPlans_F1" ("Id") ON DELETE CASCADE
            );

            INSERT INTO "BudgetPlans_F1" ("Id", "Year", "Month", "MonthlyIncomeVnd", "CreatedAtUtc")
            SELECT "Id", "Year", "Month", CAST("MonthlyIncome" AS INTEGER), "CreatedAt" FROM "BudgetPlans";

            INSERT INTO "BudgetAllocations_F1" ("Id", "BudgetPlanId", "JarType", "PercentagePoints", "BudgetVnd")
            SELECT "Id", "BudgetPlanId", "JarType", CAST("Percentage" AS INTEGER), CAST("Amount" AS INTEGER) FROM "BudgetAllocations";

            DROP TABLE "BudgetAllocations";
            DROP TABLE "BudgetPlans";
            ALTER TABLE "BudgetPlans_F1" RENAME TO "BudgetPlans";
            ALTER TABLE "BudgetAllocations_F1" RENAME TO "BudgetAllocations";

            CREATE UNIQUE INDEX "IX_BudgetPlans_Year_Month" ON "BudgetPlans" ("Year", "Month");
            CREATE UNIQUE INDEX "IX_BudgetAllocations_BudgetPlanId_JarType" ON "BudgetAllocations" ("BudgetPlanId", "JarType");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE "BudgetPlans_Legacy" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_BudgetPlans_Legacy" PRIMARY KEY AUTOINCREMENT,
                "Year" INTEGER NOT NULL,
                "Month" INTEGER NOT NULL,
                "MonthlyIncome" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL
            );

            CREATE TABLE "BudgetAllocations_Legacy" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_BudgetAllocations_Legacy" PRIMARY KEY AUTOINCREMENT,
                "BudgetPlanId" INTEGER NOT NULL,
                "JarType" TEXT NOT NULL,
                "Percentage" TEXT NOT NULL,
                "Amount" TEXT NOT NULL,
                CONSTRAINT "FK_BudgetAllocations_Legacy_BudgetPlans_Legacy_BudgetPlanId" FOREIGN KEY ("BudgetPlanId") REFERENCES "BudgetPlans_Legacy" ("Id") ON DELETE CASCADE
            );

            INSERT INTO "BudgetPlans_Legacy" ("Id", "Year", "Month", "MonthlyIncome", "CreatedAt")
            SELECT "Id", "Year", "Month", CAST("MonthlyIncomeVnd" AS TEXT), "CreatedAtUtc" FROM "BudgetPlans";

            INSERT INTO "BudgetAllocations_Legacy" ("Id", "BudgetPlanId", "JarType", "Percentage", "Amount")
            SELECT "Id", "BudgetPlanId", "JarType", CAST("PercentagePoints" AS TEXT), CAST("BudgetVnd" AS TEXT) FROM "BudgetAllocations";

            DROP TABLE "BudgetAllocations";
            DROP TABLE "BudgetPlans";
            ALTER TABLE "BudgetPlans_Legacy" RENAME TO "BudgetPlans";
            ALTER TABLE "BudgetAllocations_Legacy" RENAME TO "BudgetAllocations";

            CREATE UNIQUE INDEX "IX_BudgetPlans_Year_Month" ON "BudgetPlans" ("Year", "Month");
            CREATE INDEX "IX_BudgetAllocations_BudgetPlanId" ON "BudgetAllocations" ("BudgetPlanId");
            """);
    }
}
