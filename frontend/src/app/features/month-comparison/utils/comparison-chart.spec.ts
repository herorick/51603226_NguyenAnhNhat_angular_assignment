import { describe, expect, it } from 'vitest';

import { MonthComparisonResponse } from '../../../models/budget-plan.models';
import { jarColor } from '../../../shared/constants/jar-colors';
import { MONTH_COMPARISON_FIXTURE } from '../../../testing/fixtures';
import { buildComparisonView, compactVnd, isRangeOption, niceCeiling } from './comparison-chart';

describe('niceCeiling', () => {
  it.each([
    [0, 1],
    [-5, 1],
    [Number.NaN, 1],
    [1.3, 2],
    [3, 5],
    [7, 10],
    [20_000_000, 20_000_000],
    [21_000_000, 25_000_000],
    [5_005_000_000, 10_000_000_000]
  ])('%d -> %d', (value, expected) => {
    expect(niceCeiling(value)).toBe(expected);
  });
});

describe('compactVnd', () => {
  it.each([
    [0, '0'],
    [250_000, '250K'],
    [15_000_000, '15M'],
    [1_250_000, '1.3M']
  ])('%d -> %s', (value, expected) => {
    expect(compactVnd(value)).toBe(expected);
  });
});

describe('isRangeOption', () => {
  it('accepts only the offered ranges', () => {
    expect([3, 6, 12].every(isRangeOption)).toBe(true);
    expect([0, 1, 5, 24, Number.NaN].some(isRangeOption)).toBe(false);
  });
});

describe('buildComparisonView', () => {
  describe('all jars', () => {
    const view = buildComparisonView(MONTH_COMPARISON_FIXTURE, null);

    it('draws one column per month, scaled to the largest spent or income', () => {
      expect(view.columns.map((column) => [column.label, column.yearLabel, column.hasPlan])).toEqual([
        ['Sep', '2026', true],
        ['Oct', null, false],
        ['Nov', null, true]
      ]);
      // 20M income is the largest value and already a round number, so it is the top of the axis.
      expect(view.ticks.map((tick) => tick.label)).toEqual(['0', '5M', '10M', '15M', '20M']);
      expect(view.columns[0]).toMatchObject({ budgetPct: 100, spentPct: 50, spentLabel: '10M', overBudget: false });
      expect(view.columns[2]).toMatchObject({ budgetPct: 100, spentPct: 75, spentLabel: '15M', overBudget: false });
    });

    it('stacks only jars with spending, in catalog order, coloured per jar', () => {
      expect(view.columns[0].segments).toEqual([
        { jarType: 'livingExpenses', color: jarColor('livingExpenses'), heightPct: 40, title: 'Living Expenses: 8,000,000 VND' },
        { jarType: 'food', color: jarColor('food'), heightPct: 10, title: 'Food: 2,000,000 VND' }
      ]);
    });

    it('marks a month without a plan and gives it no bars', () => {
      expect(view.columns[1]).toMatchObject({
        segments: [],
        budgetPct: 0,
        spentLabel: '',
        title: 'October 2026: no plan'
      });
    });

    it('describes each month in the tooltip', () => {
      expect(view.columns[2].title).toBe('November 2026: spent 15,000,000 VND of income 20,000,000 VND (75%)');
    });

    it('lists every jar plus a total row, with the change against the latest earlier planned month', () => {
      expect(view.tableHeaders.map((header) => header.label)).toEqual(['Sep 2026', 'Oct 2026', 'Nov 2026']);
      expect(view.tableRows.map((row) => [row.name, row.changeText, row.changeDirection])).toEqual([
        ['Living Expenses', '0%', 'flat'],
        ['Food', '+250%', 'up'],
        ['Children', '0%', 'flat'],
        ['Emergency Fund', '0%', 'flat'],
        ['Savings', '0%', 'flat'],
        ['Investment', '0%', 'flat'],
        ['Entertainment & Travel', '0%', 'flat'],
        ['Total spent', '+50%', 'up']
      ]);

      const living = view.tableRows[0];
      expect(living.cells).toEqual([
        { text: '8,000,000', percentText: '114.3%', overBudget: true, hasPlan: true },
        { text: 'No plan', percentText: '', overBudget: false, hasPlan: false },
        { text: '8,000,000', percentText: '114.3%', overBudget: true, hasPlan: true }
      ]);
      expect(view.tableRows.at(-1)?.cells[2]).toEqual({
        text: '15,000,000',
        percentText: '75% of income',
        overBudget: false,
        hasPlan: true
      });
    });

    it('summarises the range from the API amounts', () => {
      expect(view.summary).toEqual({
        totalSpentText: '25,000,000 VND',
        averageSpentText: '12,500,000 VND',
        plannedMonthCount: 2,
        highestMonthLabel: 'November 2026',
        highestMonthText: '15,000,000 VND'
      });
      expect(view.hasAnyPlan).toBe(true);
      expect(view.budgetLegend).toBe('Monthly income');
      expect(view.legend).toHaveLength(7);
    });
  });

  describe('one jar', () => {
    const view = buildComparisonView(MONTH_COMPARISON_FIXTURE, 'food');

    it('scales to that jar and outlines its budget', () => {
      // Largest value is November's 7M spent -> axis top 10M; the 4M budget is 40% high.
      expect(view.ticks.at(-1)?.label).toBe('10M');
      expect(view.columns[2]).toMatchObject({ budgetPct: 40, spentPct: 70, overBudget: true, spentLabel: '7M' });
      expect(view.columns[2].segments.map((segment) => segment.jarType)).toEqual(['food']);
      expect(view.columns[2].title).toBe('November 2026: spent 7,000,000 VND of budget 4,000,000 VND (175%)');
    });

    it('shows only that jar in the legend and the table, without a total row', () => {
      expect(view.legend.map((item) => item.name)).toEqual(['Food']);
      expect(view.budgetLegend).toBe('Food budget');
      expect(view.tableRows.map((row) => row.name)).toEqual(['Food']);
    });

    it('summarises that jar only', () => {
      expect(view.summary).toMatchObject({
        totalSpentText: '9,000,000 VND',
        averageSpentText: '4,500,000 VND',
        highestMonthLabel: 'November 2026',
        highestMonthText: '7,000,000 VND'
      });
    });
  });

  it('handles a range without any plan', () => {
    const empty: MonthComparisonResponse = {
      ...MONTH_COMPARISON_FIXTURE,
      months: MONTH_COMPARISON_FIXTURE.months.map((month) => ({
        ...month,
        hasPlan: false,
        monthlyIncomeVnd: '0',
        spentVnd: '0',
        percentageUsed: 0,
        jars: []
      }))
    };

    const view = buildComparisonView(empty, null);

    expect(view.hasAnyPlan).toBe(false);
    expect(view.summary).toMatchObject({ averageSpentText: '—', highestMonthLabel: '—', plannedMonthCount: 0 });
    expect(view.tableRows.every((row) => row.changeText === '—')).toBe(true);
  });

  it('reports a jar that had nothing the month before as New', () => {
    const months = MONTH_COMPARISON_FIXTURE.months.map((month) =>
      month.month === 9
        ? { ...month, jars: month.jars.map((jar) => (jar.jarType === 'food' ? { ...jar, spentBudgetVnd: '0' } : jar)) }
        : month
    );

    const view = buildComparisonView({ ...MONTH_COMPARISON_FIXTURE, months }, null);

    expect(view.tableRows[1]).toMatchObject({ name: 'Food', changeText: 'New', changeDirection: 'up' });
  });

  it('shows a decrease with a minus sign', () => {
    const months = [...MONTH_COMPARISON_FIXTURE.months].reverse().map((month, index) => ({
      ...month,
      month: 9 + index
    }));

    const view = buildComparisonView({ ...MONTH_COMPARISON_FIXTURE, months }, null);

    expect(view.tableRows.at(-1)).toMatchObject({ changeText: '−33.3%', changeDirection: 'down' });
  });
});
