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

    /// <summary>Every monthly plan, newest month first, with the total spent against it.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BudgetPlanSummaryResponse>>> List()
    {
        var plans = await db.BudgetPlans.AsNoTracking()
            .OrderByDescending(plan => plan.Year)
            .ThenByDescending(plan => plan.Month)
            .Select(plan => new { plan.Id, plan.Year, plan.Month, plan.MonthlyIncomeVnd, plan.CreatedAtUtc })
            .ToListAsync();

        var totalsByPlan = await db.Expenses.AsNoTracking()
            .GroupBy(expense => expense.BudgetAllocation.BudgetPlanId)
            .Select(group => new
            {
                BudgetPlanId = group.Key,
                SpentVnd = group.Sum(expense => expense.AmountVnd),
                Count = group.Count()
            })
            .ToDictionaryAsync(group => group.BudgetPlanId);

        return Ok(plans.Select(plan =>
        {
            var spentVnd = totalsByPlan.TryGetValue(plan.Id, out var totals) ? totals.SpentVnd : 0L;
            return new BudgetPlanSummaryResponse(
                plan.Year,
                plan.Month,
                "VND",
                plan.MonthlyIncomeVnd.ToString(CultureInfo.InvariantCulture),
                spentVnd.ToString(CultureInfo.InvariantCulture),
                (plan.MonthlyIncomeVnd - spentVnd).ToString(CultureInfo.InvariantCulture),
                plan.MonthlyIncomeVnd > 0 ? decimal.Round((decimal)spentVnd * 100m / plan.MonthlyIncomeVnd, 2) : 0m,
                totals?.Count ?? 0,
                DateTime.SpecifyKind(plan.CreatedAtUtc, DateTimeKind.Utc));
        }).ToList());
    }

    /// <summary>The expenses recorded in one month, newest first.</summary>
    [HttpGet("{year:int}/{month:int}/expenses")]
    public async Task<ActionResult<MonthlyExpensesResponse>> GetExpenses(int year, int month)
    {
        var errors = ValidatePeriod(year, month);
        if (errors.Count > 0)
        {
            return BadRequest(new ApiErrorResponse { Code = "VALIDATION_ERROR", Message = "The requested month is invalid.", Errors = errors });
        }

        var planId = await db.BudgetPlans.AsNoTracking()
            .Where(plan => plan.Year == year && plan.Month == month)
            .Select(plan => (int?)plan.Id)
            .SingleOrDefaultAsync();
        if (planId is null)
        {
            return NotFound(new ApiErrorResponse { Code = "MONTHLY_PLAN_NOT_FOUND", Message = "No monthly plan exists for this month.", Errors = [] });
        }

        var rows = await db.Expenses.AsNoTracking()
            .Where(expense => expense.BudgetAllocation.BudgetPlanId == planId)
            .OrderByDescending(expense => expense.ExpenseDate)
            .ThenByDescending(expense => expense.Id)
            .Select(expense => new
            {
                expense.Id,
                expense.ExpenseDate,
                expense.AmountVnd,
                expense.Description,
                expense.CreatedAtUtc,
                expense.BudgetAllocation.JarType
            })
            .ToListAsync();

        var expenses = rows.Select(row =>
        {
            var jar = DefaultJarCatalog.Get(row.JarType);
            return new SavedExpenseResponse
            {
                Id = row.Id,
                ExpenseDate = row.ExpenseDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                JarType = jar.ApiValue,
                JarName = jar.Name,
                AmountVnd = row.AmountVnd.ToString(CultureInfo.InvariantCulture),
                Description = row.Description,
                CreatedAtUtc = DateTime.SpecifyKind(row.CreatedAtUtc, DateTimeKind.Utc)
            };
        }).ToList();

        return Ok(new MonthlyExpensesResponse(year, month, "VND", expenses));
    }

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

    /// <summary>
    /// Deletes a month's plan together with its jar allocations and every expense recorded against it,
    /// so the month can be set up again from scratch.
    /// </summary>
    [HttpDelete("{year:int}/{month:int}")]
    public async Task<IActionResult> DeleteByMonth(int year, int month)
    {
        var errors = ValidatePeriod(year, month);
        if (errors.Count > 0)
        {
            return BadRequest(new ApiErrorResponse { Code = "VALIDATION_ERROR", Message = "The requested month is invalid.", Errors = errors });
        }

        var planId = await db.BudgetPlans
            .Where(plan => plan.Year == year && plan.Month == month)
            .Select(plan => (int?)plan.Id)
            .SingleOrDefaultAsync();
        if (planId is null)
        {
            return NotFound(new ApiErrorResponse { Code = "MONTHLY_PLAN_NOT_FOUND", Message = "No monthly plan exists for this month.", Errors = [] });
        }

        // Explicit child deletes, so the result never depends on SQLite foreign-key enforcement being switched on.
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Expenses.Where(expense => expense.BudgetAllocation.BudgetPlanId == planId).ExecuteDeleteAsync();
        await db.BudgetAllocations.Where(allocation => allocation.BudgetPlanId == planId).ExecuteDeleteAsync();
        await db.BudgetPlans.Where(plan => plan.Id == planId).ExecuteDeleteAsync();
        await transaction.CommitAsync();

        return NoContent();
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

    public const int MaxComparisonMonths = 24;

    /// <summary>
    /// Spending by jar for <paramref name="months"/> consecutive months ending at <paramref name="endYear"/>/<paramref name="endMonth"/>,
    /// oldest first. Months without a plan are included with <c>hasPlan: false</c>.
    /// </summary>
    [HttpGet("comparison")]
    public async Task<ActionResult<MonthComparisonResponse>> GetComparison(
        [FromQuery] int endYear,
        [FromQuery] int endMonth,
        [FromQuery] int months = 6)
    {
        var errors = new List<ApiFieldError>();
        if (endYear is < 1 or > 9999)
        {
            errors.Add(new ApiFieldError { Field = "endYear", Code = "OUT_OF_RANGE", Message = "End year must be between 1 and 9999." });
        }

        if (endMonth is < 1 or > 12)
        {
            errors.Add(new ApiFieldError { Field = "endMonth", Code = "OUT_OF_RANGE", Message = "End month must be between 1 and 12." });
        }

        if (months is < 1 or > MaxComparisonMonths)
        {
            errors.Add(new ApiFieldError
            {
                Field = "months",
                Code = "OUT_OF_RANGE",
                Message = $"Months must be between 1 and {MaxComparisonMonths}."
            });
        }

        var endIndex = endYear * 12 + (endMonth - 1);
        var startIndex = endIndex - (months - 1);
        if (errors.Count == 0 && startIndex < 12)
        {
            errors.Add(new ApiFieldError { Field = "months", Code = "OUT_OF_RANGE", Message = "The range starts before year 1." });
        }

        if (errors.Count > 0)
        {
            return BadRequest(new ApiErrorResponse { Code = "VALIDATION_ERROR", Message = "The requested range is invalid.", Errors = errors });
        }

        var plans = await db.BudgetPlans.AsNoTracking()
            .Include(plan => plan.Allocations)
            .Where(plan => plan.Year * 12 + plan.Month - 1 >= startIndex && plan.Year * 12 + plan.Month - 1 <= endIndex)
            .ToListAsync();

        var allocationIds = plans.SelectMany(plan => plan.Allocations).Select(allocation => allocation.Id).ToArray();
        var spentByAllocation = await db.Expenses.AsNoTracking()
            .Where(expense => allocationIds.Contains(expense.BudgetAllocationId))
            .GroupBy(expense => expense.BudgetAllocationId)
            .Select(group => new { BudgetAllocationId = group.Key, SpentVnd = group.Sum(expense => expense.AmountVnd) })
            .ToDictionaryAsync(group => group.BudgetAllocationId, group => group.SpentVnd);

        var plansByIndex = plans.ToDictionary(plan => plan.Year * 12 + plan.Month - 1);
        var catalog = DefaultJarCatalog.All;
        var result = new List<ComparisonMonthResponse>(months);
        for (var index = startIndex; index <= endIndex; index++)
        {
            var year = index / 12;
            var month = index % 12 + 1;
            if (!plansByIndex.TryGetValue(index, out var plan))
            {
                result.Add(new ComparisonMonthResponse(year, month, false, "0", "0", 0m, []));
                continue;
            }

            var allocationsByJar = plan.Allocations.ToDictionary(allocation => allocation.JarType);
            var jars = catalog
                .Where(jar => allocationsByJar.ContainsKey(jar.JarType))
                .Select(jar =>
                {
                    var allocation = allocationsByJar[jar.JarType];
                    var spent = spentByAllocation.GetValueOrDefault(allocation.Id);
                    return new ComparisonMonthJarResponse(
                        jar.ApiValue,
                        allocation.BudgetVnd.ToString(CultureInfo.InvariantCulture),
                        spent.ToString(CultureInfo.InvariantCulture),
                        allocation.BudgetVnd > 0 ? decimal.Round((decimal)spent * 100m / allocation.BudgetVnd, 2) : 0m);
                })
                .ToList();

            var spentVnd = plan.Allocations.Sum(allocation => spentByAllocation.GetValueOrDefault(allocation.Id));
            result.Add(new ComparisonMonthResponse(
                year,
                month,
                true,
                plan.MonthlyIncomeVnd.ToString(CultureInfo.InvariantCulture),
                spentVnd.ToString(CultureInfo.InvariantCulture),
                plan.MonthlyIncomeVnd > 0 ? decimal.Round((decimal)spentVnd * 100m / plan.MonthlyIncomeVnd, 2) : 0m,
                jars));
        }

        return Ok(new MonthComparisonResponse(
            "VND",
            catalog.Select(jar => new ComparisonJarResponse(jar.ApiValue, jar.Name)).ToList(),
            result));
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

    /// <summary>
    /// Replaces an expense's date, jar, amount and description. The new date must fall in a month that has a plan;
    /// the expense moves to that plan's allocation for the selected jar.
    /// </summary>
    [HttpPut("expenses/{id:int}")]
    public async Task<ActionResult<CreateExpenseResponse>> UpdateExpense(int id, CreateExpenseRequest request)
    {
        var expense = await db.Expenses.SingleOrDefaultAsync(item => item.Id == id);
        if (expense is null)
        {
            return NotFound(ExpenseNotFoundResponse());
        }

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
        expense.BudgetAllocationId = allocation.Id;
        expense.ExpenseDate = selectedDate;
        expense.AmountVnd = amountVnd;
        expense.Description = request.Description!.Trim();
        await db.SaveChangesAsync();

        var spentVnd = await db.Expenses
            .Where(item => item.BudgetAllocationId == allocation.Id)
            .SumAsync(item => item.AmountVnd);
        await transaction.CommitAsync();

        return Ok(new CreateExpenseResponse
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
        });
    }

    /// <summary>Deletes one expense (204), so a wrong entry can be removed and recorded again.</summary>
    [HttpDelete("expenses/{id:int}")]
    public async Task<IActionResult> DeleteExpense(int id)
    {
        var deleted = await db.Expenses.Where(item => item.Id == id).ExecuteDeleteAsync();
        return deleted == 0 ? NotFound(ExpenseNotFoundResponse()) : NoContent();
    }

    private static ApiErrorResponse ExpenseNotFoundResponse() => new()
    {
        Code = "EXPENSE_NOT_FOUND",
        Message = "The expense does not exist or was already deleted.",
        Errors = []
    };

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

    /// <summary>Position of each jar in the catalog, so plans are always returned in catalog order.</summary>
    private static readonly IReadOnlyDictionary<JarType, int> CatalogOrder = DefaultJarCatalog.All
        .Select((jar, index) => (jar.JarType, index))
        .ToDictionary(entry => entry.JarType, entry => entry.index);

    private static BudgetPlanResponse Map(BudgetPlan plan) => new()
    {
        Id = plan.Id,
        Year = plan.Year,
        Month = plan.Month,
        MonthlyIncomeVnd = plan.MonthlyIncomeVnd.ToString(CultureInfo.InvariantCulture),
        Currency = "VND",
        CreatedAtUtc = DateTime.SpecifyKind(plan.CreatedAtUtc, DateTimeKind.Utc),
        Jars = plan.Allocations.OrderBy(allocation => CatalogOrder[allocation.JarType])
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
