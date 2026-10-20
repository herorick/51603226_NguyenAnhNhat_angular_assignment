using System.Globalization;
using System.Text;
using FamilyFinance.Api.Data;
using FamilyFinance.Api.DTOs;
using FamilyFinance.Api.Models;
using FamilyFinance.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace FamilyFinance.Api.Controllers;

[ApiController]
[Route("api/v1/budget-plans")]
public class BudgetPlansController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet("default-jars")]
    public ActionResult<DefaultJarsResponse> GetDefaultJars() => Ok(DefaultJarCatalog.ToResponse());

    [HttpPost]
    public async Task<ActionResult<BudgetPlanResponse>> Create(CreateBudgetPlanRequest request)
    {
        var errors = Validate(request, out var incomeVnd);
        if (errors.Count > 0)
        {
            return BadRequest(new ApiErrorResponse { Code = "VALIDATION_ERROR", Message = "One or more fields are invalid.", Errors = errors });
        }

        if (await db.BudgetPlans.AnyAsync(plan => plan.Year == request.Year && plan.Month == request.Month))
        {
            return Conflict(DuplicateResponse());
        }

        var plan = new BudgetPlan
        {
            Year = request.Year,
            Month = request.Month,
            MonthlyIncomeVnd = incomeVnd,
            CreatedAtUtc = DateTime.UtcNow,
            Allocations = BudgetAllocator.Allocate(incomeVnd).Select(allocation => new BudgetAllocation
            {
                JarType = allocation.Jar.JarType,
                PercentagePoints = allocation.Jar.Percentage,
                BudgetVnd = allocation.BudgetVnd
            }).ToList()
        };

        db.BudgetPlans.Add(plan);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (IsMonthlyUniquenessViolation(exception))
        {
            return Conflict(DuplicateResponse());
        }

        return Created($"/api/v1/budget-plans/{plan.Year}/{plan.Month}", Map(plan));
    }

    [HttpGet("{year:int}/{month:int}")]
    public async Task<ActionResult<BudgetPlanResponse>> GetByMonth(int year, int month)
    {
        var errors = ValidatePeriod(year, month);
        if (errors.Count > 0)
        {
            return BadRequest(new ApiErrorResponse { Code = "VALIDATION_ERROR", Message = "One or more fields are invalid.", Errors = errors });
        }

        var plan = await db.BudgetPlans.Include(item => item.Allocations)
            .SingleOrDefaultAsync(item => item.Year == year && item.Month == month);
        return plan is null
            ? NotFound(new ApiErrorResponse { Code = "MONTHLY_PLAN_NOT_FOUND", Message = "No monthly plan exists for this month." })
            : Ok(Map(plan));
    }

    [HttpGet("{year:int}/{month:int}/spending-by-jars")]
    public async Task<ActionResult<SpendingByJarsResponse>> GetSpendingByJars(int year, int month)
    {
        var errors = ValidatePeriod(year, month);
        if (errors.Count > 0)
        {
            return BadRequest(new ApiErrorResponse
            {
                Code = "VALIDATION_ERROR",
                Message = "The requested month is invalid.",
                Errors = errors
            });
        }

        var plan = await db.BudgetPlans.AsNoTracking()
            .Include(item => item.Allocations)
            .SingleOrDefaultAsync(item => item.Year == year && item.Month == month);
        if (plan is null)
        {
            return NotFound(new ApiErrorResponse
            {
                Code = "MONTHLY_PLAN_NOT_FOUND",
                Message = "Create a monthly plan before viewing spending by jar.",
                Errors = []
            });
        }

        var catalog = DefaultJarCatalog.All;
        var expectedJarTypes = catalog.Select(jar => jar.JarType).ToHashSet();
        if (plan.Allocations.Count != catalog.Count ||
            plan.Allocations.Select(allocation => allocation.JarType).Distinct().Count() != catalog.Count ||
            !expectedJarTypes.SetEquals(plan.Allocations.Select(allocation => allocation.JarType)) ||
            plan.Allocations.Any(allocation => allocation.BudgetVnd <= 0))
        {
            return StatusCode(StatusCodes.Status500InternalServerError, InternalErrorResponse());
        }

        var allocationIds = plan.Allocations.Select(allocation => allocation.Id).ToArray();
        var spentByAllocation = await db.Expenses.AsNoTracking()
            .Where(expense => allocationIds.Contains(expense.BudgetAllocationId))
            .GroupBy(expense => expense.BudgetAllocationId)
            .Select(group => new
            {
                BudgetAllocationId = group.Key,
                SpentVnd = group.Sum(expense => expense.AmountVnd)
            })
            .ToDictionaryAsync(group => group.BudgetAllocationId, group => group.SpentVnd);

        var allocationsByJar = plan.Allocations.ToDictionary(allocation => allocation.JarType);
        var jars = catalog.Select(jar =>
        {
            var allocation = allocationsByJar[jar.JarType];
            var spentVnd = spentByAllocation.GetValueOrDefault(allocation.Id);
            var percentageUsed = decimal.Round((decimal)spentVnd * 100m / allocation.BudgetVnd, 2);
            return new SpendingByJarResponse(
                jar.ApiValue,
                jar.Name,
                percentageUsed,
                allocation.BudgetVnd.ToString(CultureInfo.InvariantCulture),
                spentVnd.ToString(CultureInfo.InvariantCulture));
        }).ToList();

        return Ok(new SpendingByJarsResponse(year, month, "VND", jars));
    }

    [HttpPost("expenses")]
    public async Task<ActionResult<CreateExpenseResponse>> CreateExpense(CreateExpenseRequest request)
    {
        var requestErrors = ValidateExpenseRequest(request, out var expenseDate, out var amountVnd, out var jar);
        if (requestErrors.Count > 0)
        {
            return BadRequest(ValidationResponse(requestErrors));
        }

        var selectedDate = expenseDate!.Value;
        var selectedJar = jar!;
        var plan = await db.BudgetPlans.SingleOrDefaultAsync(item => item.Year == selectedDate.Year && item.Month == selectedDate.Month);
        if (plan is null)
        {
            return NotFound(new ApiErrorResponse
            {
                Code = "MONTHLY_PLAN_NOT_FOUND",
                Message = "No monthly plan exists for this month."
            });
        }

        var allocation = await db.BudgetAllocations.SingleOrDefaultAsync(item =>
            item.BudgetPlanId == plan.Id && item.JarType == selectedJar.JarType);
        if (allocation is null)
        {
            return BadRequest(new ApiErrorResponse
            {
                Code = "JAR_NOT_IN_MONTHLY_PLAN",
                Message = "The selected jar is not part of this monthly plan.",
                Errors = []
            });
        }


        await using var transaction = await db.Database.BeginTransactionAsync();
        var expense = new Expense
        {
            BudgetAllocationId = allocation.Id,
            ExpenseDate = selectedDate,
            AmountVnd = amountVnd,
            Description = request.Description!.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };

        db.Expenses.Add(expense);
        await db.SaveChangesAsync();

        var spentVnd = await db.Expenses
            .Where(item => item.BudgetAllocationId == allocation.Id)
            .SumAsync(item => item.AmountVnd);
        var response = new CreateExpenseResponse
        {
            Expense = new SavedExpenseResponse
            {
                Id = expense.Id,
                ExpenseDate = expense.ExpenseDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                JarType = selectedJar.ApiValue,
                JarName = selectedJar.Name,
                AmountVnd = expense.AmountVnd.ToString(CultureInfo.InvariantCulture),
                Description = expense.Description,
                CreatedAtUtc = DateTime.SpecifyKind(expense.CreatedAtUtc, DateTimeKind.Utc)
            },
            JarSummary = new ExpenseJarSummaryResponse
            {
                JarType = selectedJar.ApiValue,
                JarName = selectedJar.Name,
                Percentage = allocation.PercentagePoints,
                BudgetVnd = allocation.BudgetVnd.ToString(CultureInfo.InvariantCulture),
                SpentVnd = spentVnd.ToString(CultureInfo.InvariantCulture),
                RemainingVnd = (allocation.BudgetVnd - spentVnd).ToString(CultureInfo.InvariantCulture)
            }
        };

        await transaction.CommitAsync();
        return Created($"/api/v1/budget-plans/expenses/{expense.Id}", response);
    }

    private static List<ApiFieldError> ValidateExpenseRequest(
        CreateExpenseRequest request,
        out DateOnly? expenseDate,
        out long amountVnd,
        out JarDefinition? jar)
    {
        expenseDate = null;
        amountVnd = 0;
        jar = null;
        var errors = new List<ApiFieldError>();

        if (string.IsNullOrEmpty(request.ExpenseDate))
        {
            errors.Add(new ApiFieldError { Field = "expenseDate", Code = "REQUIRED", Message = "Expense date is required." });
        }
        else if (!DateOnly.TryParseExact(request.ExpenseDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
        {
            errors.Add(new ApiFieldError { Field = "expenseDate", Code = "INVALID_FORMAT", Message = "Expense date must use YYYY-MM-DD format." });
        }
        else
        {
            expenseDate = parsedDate;
        }

        if (string.IsNullOrEmpty(request.JarType))
        {
            errors.Add(new ApiFieldError { Field = "jarType", Code = "REQUIRED", Message = "Jar type is required." });
        }
        else
        {
            jar = DefaultJarCatalog.All.SingleOrDefault(item => item.ApiValue == request.JarType);
            if (jar is null)
            {
                errors.Add(new ApiFieldError { Field = "jarType", Code = "INVALID_VALUE", Message = "Jar type is not valid." });
            }
        }

        if (string.IsNullOrEmpty(request.AmountVnd))
        {
            errors.Add(new ApiFieldError { Field = "amountVnd", Code = "REQUIRED", Message = "Expense amount is required." });
        }
        else if (request.AmountVnd.Any(character => character is < '0' or > '9') ||
                 !long.TryParse(request.AmountVnd, NumberStyles.None, CultureInfo.InvariantCulture, out amountVnd))
        {
            errors.Add(new ApiFieldError { Field = "amountVnd", Code = "INVALID_FORMAT", Message = "Expense amount must contain ASCII digits and fit in a signed 64-bit integer." });
        }
        else if (amountVnd <= 0)
        {
            errors.Add(new ApiFieldError { Field = "amountVnd", Code = "MUST_BE_POSITIVE", Message = "Expense amount must be greater than zero." });
        }

        var description = request.Description?.Trim();
        if (string.IsNullOrEmpty(description))
        {
            errors.Add(new ApiFieldError { Field = "description", Code = "REQUIRED", Message = "Description is required." });
        }
        else if (description.EnumerateRunes().Count() > 500)
        {
            errors.Add(new ApiFieldError { Field = "description", Code = "TOO_LONG", Message = "Description must not exceed 500 characters." });
        }

        return errors;
    }

    private static ApiErrorResponse ValidationResponse(List<ApiFieldError> errors) => new()
    {
        Code = "VALIDATION_ERROR",
        Message = "One or more fields are invalid.",
        Errors = errors
    };

    private static List<ApiFieldError> ValidatePeriod(int year, int month)
    {
        var errors = new List<ApiFieldError>();
        if (year is < 1 or > 9999)
        {
            errors.Add(new ApiFieldError { Field = "year", Code = "OUT_OF_RANGE", Message = "Year must be between 1 and 9999." });
        }

        if (month is < 1 or > 12)
        {
            errors.Add(new ApiFieldError { Field = "month", Code = "OUT_OF_RANGE", Message = "Month must be between 1 and 12." });
        }

        return errors;
    }

    private static List<ApiFieldError> Validate(CreateBudgetPlanRequest request, out long incomeVnd)
    {
        incomeVnd = 0;
        var errors = ValidatePeriod(request.Year, request.Month);
        if (string.IsNullOrEmpty(request.MonthlyIncomeVnd))
        {
            errors.Add(new ApiFieldError { Field = "monthlyIncomeVnd", Code = "REQUIRED", Message = "Monthly income is required." });
        }
        else if (request.MonthlyIncomeVnd.Any(character => character is < '0' or > '9') ||
                 !long.TryParse(request.MonthlyIncomeVnd, NumberStyles.None, CultureInfo.InvariantCulture, out incomeVnd))
        {
            errors.Add(new ApiFieldError { Field = "monthlyIncomeVnd", Code = "INVALID_FORMAT", Message = "Monthly income must contain ASCII digits and fit in a signed 64-bit integer." });
        }
        else if (incomeVnd <= 0)
        {
            errors.Add(new ApiFieldError { Field = "monthlyIncomeVnd", Code = "MUST_BE_POSITIVE", Message = "Monthly income must be greater than zero." });
        }

        return errors;
    }

    private static bool IsMonthlyUniquenessViolation(DbUpdateException exception) =>
        exception.InnerException is SqliteException { SqliteExtendedErrorCode: 2067 } sqliteException &&
        sqliteException.Message.Contains("BudgetPlans.Year", StringComparison.OrdinalIgnoreCase) &&
        sqliteException.Message.Contains("BudgetPlans.Month", StringComparison.OrdinalIgnoreCase);

    private static ApiErrorResponse DuplicateResponse() => new()
    {
        Code = "MONTHLY_PLAN_ALREADY_EXISTS",
        Message = "A monthly plan already exists for this month."
    };

    private static ApiErrorResponse InternalErrorResponse() => new()
    {
        Code = "INTERNAL_ERROR",
        Message = "An unexpected error occurred.",
        Errors = []
    };

    private static BudgetPlanResponse Map(BudgetPlan plan) => new()
    {
        Id = plan.Id,
        Year = plan.Year,
        Month = plan.Month,
        MonthlyIncomeVnd = plan.MonthlyIncomeVnd.ToString(CultureInfo.InvariantCulture),
        Currency = "VND",
        CreatedAtUtc = DateTime.SpecifyKind(plan.CreatedAtUtc, DateTimeKind.Utc),
        Jars = plan.Allocations.OrderBy(allocation => DefaultJarCatalog.All.ToList().FindIndex(jar => jar.JarType == allocation.JarType))
            .Select(allocation =>
            {
                var jar = DefaultJarCatalog.Get(allocation.JarType);
                return new BudgetJarResponse
                {
                    JarType = jar.ApiValue,
                    Name = jar.Name,
                    Percentage = allocation.PercentagePoints,
                    BudgetVnd = allocation.BudgetVnd.ToString(CultureInfo.InvariantCulture)
                };
            }).ToList()
    };
}
