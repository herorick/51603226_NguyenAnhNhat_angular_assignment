using FamilyFinance.Api.Models;

namespace FamilyFinance.Api.Services;

public static class BudgetAllocator
{
    public static IReadOnlyList<(JarDefinition Jar, long BudgetVnd)> Allocate(long incomeVnd)
    {
        if (incomeVnd <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(incomeVnd));
        }

        if (DefaultJarCatalog.All.Count != 7 || DefaultJarCatalog.TotalPercentage != 100)
        {
            throw new InvalidOperationException("The default jar catalog must contain seven jars totaling 100%.");
        }

        var allocations = DefaultJarCatalog.All.Select((jar, index) =>
        {
            var product = (decimal)incomeVnd * jar.Percentage;
            var budget = (long)decimal.Floor(product / 100m);
            var remainder = (int)((incomeVnd % 100) * jar.Percentage % 100);
            return new Allocation(jar, index, budget, remainder);
        }).ToList();

        var leftover = incomeVnd - allocations.Sum(allocation => allocation.BudgetVnd);
        foreach (var allocation in allocations.OrderByDescending(allocation => allocation.Remainder).ThenBy(allocation => allocation.Index).Take(checked((int)leftover)))
        {
            allocation.BudgetVnd++;
        }

        if (allocations.Any(allocation => allocation.BudgetVnd < 0) || allocations.Sum(allocation => allocation.BudgetVnd) != incomeVnd)
        {
            throw new InvalidOperationException("The calculated jar budgets must be non-negative and sum to monthly income.");
        }

        return allocations.Select(allocation => (allocation.Jar, allocation.BudgetVnd)).ToList();
    }

    private sealed class Allocation(JarDefinition jar, int index, long budgetVnd, int remainder)
    {
        public JarDefinition Jar { get; } = jar;
        public int Index { get; } = index;
        public long BudgetVnd { get; set; } = budgetVnd;
        public int Remainder { get; } = remainder;
    }
}
