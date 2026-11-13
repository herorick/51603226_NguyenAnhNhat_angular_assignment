import { ComparisonMonth, JarType, MonthComparisonResponse } from '../../../models/budget-plan.models';
import { jarColor } from '../../../shared/constants/jar-colors';
import { formatVnd } from '../../../shared/pipes/vnd.pipe';
import { Period, formatPeriodLabel } from '../../monthly-planning/utils/period';

/**
 * Turns the comparison response into what the page draws. Money text always comes from the API digit strings
 * (`BigInt`, exact). Bar heights and percentage changes use `Number`: they are visual only and never sent anywhere.
 */

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const PERCENT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const MONEY = /^-?\d+$/;

export const RANGE_OPTIONS = [3, 6, 12] as const;
export const DEFAULT_RANGE = 6;

/** Visual-only conversion of a money string; anything malformed counts as zero. */
const toNumber = (value: string): number => (MONEY.test(value) ? Number(value) : 0);
const toBigInt = (value: string): bigint => (MONEY.test(value) ? BigInt(value) : 0n);

/** `25,000,000` without the currency: table cells, where the header already says VND. */
const groupDigits = (value: bigint): string => value.toLocaleString('en-US');

/** `1.3M`, `250K`, `0`: axis ticks and labels above the columns. */
export const compactVnd = (value: number): string => (value <= 0 ? '0' : COMPACT.format(value));

/** Smallest "nice" number (1, 2, 2.5, 5 x 10^n) at or above `value`, so the axis gets round tick labels. */
export const niceCeiling = (value: number): number => {
  if (!(value > 0) || !Number.isFinite(value)) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
};

export interface ChartSegment {
  jarType: JarType;
  color: string;
  /** Height inside the plot, 0-100. */
  heightPct: number;
  title: string;
}

export interface ChartColumn {
  key: string;
  /** `Nov` */
  label: string;
  /** Shown under the first column and every January, so a range across years stays readable. */
  yearLabel: string | null;
  hasPlan: boolean;
  /** Spent, stacked by jar (all jars) or a single bar (one jar). Oldest jar of the catalog at the bottom. */
  segments: ChartSegment[];
  /** Height of the budget outline (income for all jars, the jar budget for one jar), 0-100. */
  budgetPct: number;
  /** Top of the spent stack, 0-100: where the amount label sits. */
  spentPct: number;
  spentLabel: string;
  overBudget: boolean;
  /** Text read by the tooltip; the table below carries the same numbers for assistive technology. */
  title: string;
}

export interface TableCell {
  text: string;
  percentText: string;
  overBudget: boolean;
  hasPlan: boolean;
}

export interface TableRow {
  key: string;
  name: string;
  color: string | null;
  cells: TableCell[];
  /** Last month vs the latest earlier month with a plan: `+12.5%`, `−3%`, `New`, or `—` when there is none. */
  changeText: string;
  changeDirection: 'up' | 'down' | 'flat' | 'none';
}

export interface ComparisonSummary {
  totalSpentText: string;
  averageSpentText: string;
  plannedMonthCount: number;
  highestMonthLabel: string;
  highestMonthText: string;
}

export interface ComparisonView {
  columns: ChartColumn[];
  ticks: { label: string; bottomPct: number }[];
  legend: { jarType: JarType; name: string; color: string }[];
  budgetLegend: string;
  tableHeaders: { key: string; label: string }[];
  tableRows: TableRow[];
  summary: ComparisonSummary;
  hasAnyPlan: boolean;
}

const monthKey = (month: ComparisonMonth): string => `${month.year}-${month.month}`;
const monthLabel = (month: ComparisonMonth): string => formatPeriodLabel(month);
const shortLabel = (month: ComparisonMonth): string => MONTH_ABBREVIATIONS[month.month - 1] ?? String(month.month);

/** Spent and budget of one month for the current filter (`null` = all jars). */
const amountsFor = (month: ComparisonMonth, jar: JarType | null): { spent: string; budget: string; percent: number } => {
  if (jar === null) {
    return { spent: month.spentVnd, budget: month.monthlyIncomeVnd, percent: month.percentageUsed };
  }
  const entry = month.jars.find((item) => item.jarType === jar);
  return entry
    ? { spent: entry.spentBudgetVnd, budget: entry.plannedBudgetVnd, percent: entry.percentageUsed }
    : { spent: '0', budget: '0', percent: 0 };
};

const changeBetween = (
  previous: ComparisonMonth | undefined,
  last: ComparisonMonth | undefined,
  spentOf: (month: ComparisonMonth) => string
): Pick<TableRow, 'changeText' | 'changeDirection'> => {
  if (!previous?.hasPlan || !last?.hasPlan) {
    return { changeText: '—', changeDirection: 'none' };
  }
  const before = toNumber(spentOf(previous));
  const after = toNumber(spentOf(last));
  if (before === 0) {
    return after === 0 ? { changeText: '0%', changeDirection: 'flat' } : { changeText: 'New', changeDirection: 'up' };
  }
  const change = ((after - before) / before) * 100;
  if (Math.abs(change) < 0.05) {
    return { changeText: '0%', changeDirection: 'flat' };
  }
  return {
    changeText: `${change > 0 ? '+' : '−'}${PERCENT.format(Math.abs(change))}%`,
    changeDirection: change > 0 ? 'up' : 'down'
  };
};

export const buildComparisonView = (response: MonthComparisonResponse, jar: JarType | null): ComparisonView => {
  const months = response.months;
  const jars = jar === null ? response.jars : response.jars.filter((item) => item.jarType === jar);
  const jarName = (type: JarType): string => response.jars.find((item) => item.jarType === type)?.name ?? type;

  const scaleMax = niceCeiling(
    Math.max(
      0,
      ...months.map((month) => {
        const amounts = amountsFor(month, jar);
        return Math.max(toNumber(amounts.spent), toNumber(amounts.budget));
      })
    )
  );
  const pct = (value: number): number => Math.min(100, (value / scaleMax) * 100);

  const columns = months.map((month, index): ChartColumn => {
    const amounts = amountsFor(month, jar);
    const spent = toNumber(amounts.spent);
    const budget = toNumber(amounts.budget);
    const segments = month.hasPlan
      ? jars
          .map((item) => {
            const entry = month.jars.find((candidate) => candidate.jarType === item.jarType);
            const value = toNumber(entry?.spentBudgetVnd ?? '0');
            return {
              jarType: item.jarType,
              color: jarColor(item.jarType),
              heightPct: pct(value),
              title: `${item.name}: ${formatVnd(entry?.spentBudgetVnd ?? '0')}`
            };
          })
          .filter((segment) => segment.heightPct > 0)
      : [];
    const label = monthLabel(month);
    const budgetName = jar === null ? 'income' : 'budget';
    return {
      key: monthKey(month),
      label: shortLabel(month),
      yearLabel: index === 0 || month.month === 1 ? String(month.year) : null,
      hasPlan: month.hasPlan,
      segments,
      budgetPct: month.hasPlan ? pct(budget) : 0,
      spentPct: month.hasPlan ? pct(spent) : 0,
      spentLabel: month.hasPlan ? compactVnd(spent) : '',
      overBudget: month.hasPlan && spent > budget,
      title: month.hasPlan
        ? `${label}: spent ${formatVnd(amounts.spent)} of ${budgetName} ${formatVnd(amounts.budget)} (${PERCENT.format(amounts.percent)}%)`
        : `${label}: no plan`
    };
  });

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => ({ label: compactVnd(scaleMax * step), bottomPct: step * 100 }));

  // The last month against the latest earlier month that has a plan, so a gap month does not hide the trend.
  const last = months.at(-1);
  const previous = months.slice(0, -1).reverse().find((month) => month.hasPlan);

  const jarRows = jars.map((item): TableRow => {
    const spentOf = (month: ComparisonMonth): string =>
      month.jars.find((entry) => entry.jarType === item.jarType)?.spentBudgetVnd ?? '0';
    return {
      key: item.jarType,
      name: item.name,
      color: jarColor(item.jarType),
      cells: months.map((month): TableCell => {
        const entry = month.jars.find((candidate) => candidate.jarType === item.jarType);
        return month.hasPlan && entry
          ? {
              text: groupDigits(toBigInt(entry.spentBudgetVnd)),
              percentText: `${PERCENT.format(entry.percentageUsed)}%`,
              overBudget: entry.percentageUsed > 100,
              hasPlan: true
            }
          : { text: 'No plan', percentText: '', overBudget: false, hasPlan: false };
      }),
      ...changeBetween(previous, last, spentOf)
    };
  });

  const totalRow: TableRow = {
    key: 'total',
    name: 'Total spent',
    color: null,
    cells: months.map((month): TableCell =>
      month.hasPlan
        ? {
            text: groupDigits(toBigInt(month.spentVnd)),
            percentText: `${PERCENT.format(month.percentageUsed)}% of income`,
            overBudget: month.percentageUsed > 100,
            hasPlan: true
          }
        : { text: 'No plan', percentText: '', overBudget: false, hasPlan: false }
    ),
    ...changeBetween(previous, last, (month) => month.spentVnd)
  };

  const planned = months.filter((month) => month.hasPlan);
  const spentInFilter = planned.map((month) => ({ month, spent: toBigInt(amountsFor(month, jar).spent) }));
  const total = spentInFilter.reduce((sum, item) => sum + item.spent, 0n);
  const highest = spentInFilter.reduce<{ month: ComparisonMonth; spent: bigint } | null>(
    (best, item) => (best === null || item.spent > best.spent ? item : best),
    null
  );

  return {
    columns,
    ticks,
    legend: jars.map((item) => ({ jarType: item.jarType, name: item.name, color: jarColor(item.jarType) })),
    budgetLegend: jar === null ? 'Monthly income' : `${jarName(jar)} budget`,
    tableHeaders: months.map((month) => ({ key: monthKey(month), label: `${shortLabel(month)} ${month.year}` })),
    tableRows: jar === null ? [...jarRows, totalRow] : jarRows,
    summary: {
      totalSpentText: formatVnd(total.toString()),
      averageSpentText: planned.length > 0 ? formatVnd((total / BigInt(planned.length)).toString()) : '—',
      plannedMonthCount: planned.length,
      highestMonthLabel: highest && highest.spent > 0n ? monthLabel(highest.month) : '—',
      highestMonthText: highest && highest.spent > 0n ? formatVnd(highest.spent.toString()) : ''
    },
    hasAnyPlan: planned.length > 0
  };
};

/** `?end=2026-11&months=6&jar=food` -> state. Invalid or missing values fall back to the defaults. */
export interface ComparisonQuery {
  end: Period;
  months: number;
  jar: JarType | null;
}

export const isRangeOption = (value: number): boolean => (RANGE_OPTIONS as readonly number[]).includes(value);
