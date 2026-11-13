import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, finalize, map, of, startWith, switchMap } from 'rxjs';

import { BudgetPlanApiService } from '../../../../core/services/budget-plan-api.service';
import { AppError } from '../../../../models/api-error.models';
import { MonthlyPlanSummary } from '../../../../models/budget-plan.models';
import { formatVnd } from '../../../../shared/pipes/vnd.pipe';
import {
  Period,
  currentPeriod,
  firstDayOfPeriod,
  formatPeriodInput,
  formatPeriodLabel,
  isSamePeriod
} from '../../utils/period';

export type MonthlyPlansListView =
  | { status: 'loading' }
  | { status: 'ready'; plans: MonthlyPlanSummary[] }
  | { status: 'error'; message: string };

/** Display model of one month card. Every value comes from the API or is formatting of it. */
export interface MonthCard {
  key: string;
  period: Period;
  label: string;
  incomeText: string;
  spentText: string;
  remainingText: string;
  percentLabel: string;
  /** Visual only: capped at 100 so the fill stays inside the track. */
  barWidth: number;
  overBudget: boolean;
  expenseCountText: string;
  isCurrent: boolean;
  addExpenseQueryParams: { expenseDate?: string };
}

export interface YearGroup {
  year: number;
  months: MonthCard[];
}

export interface DeleteNotice {
  kind: 'success' | 'error';
  message: string;
  /** Present after a successful delete: link to set the same month up again. */
  setupLabel?: string;
  setupQueryParams?: { period: string };
}

export const LOAD_FAILED_MESSAGE = 'We could not load your monthly plans. Please try again.';
export const DELETE_FAILED_MESSAGE = 'We could not delete this month. Please try again.';

const PERCENT_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Overview of every month that has a plan, grouped by year, newest first. */
@Component({
  selector: 'app-monthly-plans-list-page',
  imports: [RouterLink],
  templateUrl: './monthly-plans-list-page.component.html',
  styleUrl: './monthly-plans-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthlyPlansListPageComponent {
  private readonly api = inject(BudgetPlanApiService);
  private readonly reloads = new Subject<void>();
  private readonly destroyRef = inject(DestroyRef);
  private readonly today = currentPeriod();

  readonly view = signal<MonthlyPlansListView>({ status: 'loading' });
  /** Key (`YYYY-M`) of the month whose delete is in flight; all delete buttons are locked meanwhile. */
  readonly deletingKey = signal<string | null>(null);
  /** Result of the last delete, shown above the list. */
  readonly notice = signal<DeleteNotice | null>(null);
  readonly status = computed(() => this.view().status);
  readonly errorMessage = computed(() => {
    const view = this.view();
    return view.status === 'error' ? view.message : '';
  });

  /** True when the current month has no plan yet, so the page can offer to create it. */
  readonly currentMonthMissing = computed(() => {
    const view = this.view();
    return view.status === 'ready' && !view.plans.some((plan) => isSamePeriod(plan, this.today));
  });

  readonly currentMonthLabel = formatPeriodLabel(this.today);
  readonly createCurrentQueryParams = { period: formatPeriodInput(this.today) };

  readonly groups = computed<YearGroup[]>(() => {
    const view = this.view();
    if (view.status !== 'ready') {
      return [];
    }
    const groups: YearGroup[] = [];
    for (const plan of view.plans) {
      const card = this.toCard(plan);
      const last = groups.at(-1);
      if (last?.year === plan.year) {
        last.months.push(card);
      } else {
        groups.push({ year: plan.year, months: [card] });
      }
    }
    return groups;
  });

  constructor() {
    this.reloads
      .pipe(
        startWith(undefined),
        switchMap(() => this.load()),
        takeUntilDestroyed()
      )
      .subscribe((view) => this.view.set(view));
  }

  retry(): void {
    this.reloads.next();
  }

  /**
   * Deletes a month's plan with all its expenses after a browser confirmation, then reloads the list and offers to
   * set the same month up again. A 404 means it is already gone, which is treated like a successful delete.
   */
  deleteMonth(card: MonthCard): void {
    if (this.deletingKey() !== null) {
      return;
    }
    const question = `Delete the ${card.label} plan and its ${card.expenseCountText}? This cannot be undone.`;
    if (!window.confirm(question)) {
      return;
    }

    this.deletingKey.set(card.key);
    this.notice.set(null);
    this.api
      .deleteMonthlyPlan(card.period.year, card.period.month)
      .pipe(
        finalize(() => this.deletingKey.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.afterDelete(card),
        error: (error: AppError) => {
          if (error.kind === 'not-found') {
            this.afterDelete(card);
            return;
          }
          this.notice.set({
            kind: 'error',
            message: error.kind === 'network' ? error.message : `${DELETE_FAILED_MESSAGE} (${card.label})`
          });
        }
      });
  }

  private afterDelete(card: MonthCard): void {
    this.notice.set({
      kind: 'success',
      message: `${card.label} was deleted.`,
      setupLabel: card.label,
      setupQueryParams: { period: formatPeriodInput(card.period) }
    });
    this.reloads.next();
  }

  private load(): Observable<MonthlyPlansListView> {
    return this.api.listMonthlyPlans().pipe(
      map((plans): MonthlyPlansListView =>
        Array.isArray(plans) ? { status: 'ready', plans } : { status: 'error', message: LOAD_FAILED_MESSAGE }
      ),
      catchError((error: AppError) =>
        of<MonthlyPlansListView>({
          status: 'error',
          message: error.kind === 'network' ? error.message : LOAD_FAILED_MESSAGE
        })
      ),
      startWith<MonthlyPlansListView>({ status: 'loading' })
    );
  }

  private toCard(plan: MonthlyPlanSummary): MonthCard {
    const period: Period = { year: plan.year, month: plan.month };
    const overBudget = plan.remainingVnd.startsWith('-');
    return {
      key: `${plan.year}-${plan.month}`,
      period,
      label: formatPeriodLabel(period),
      incomeText: formatVnd(plan.monthlyIncomeVnd),
      spentText: formatVnd(plan.spentVnd),
      remainingText: formatVnd(plan.remainingVnd),
      percentLabel: `${PERCENT_FORMAT.format(plan.percentageUsed)}%`,
      barWidth: Math.min(Math.max(plan.percentageUsed, 0), 100),
      overBudget,
      expenseCountText: plan.expenseCount === 1 ? '1 expense' : `${plan.expenseCount} expenses`,
      isCurrent: isSamePeriod(period, this.today),
      // The current month opens on today's date (the page default); other months on their first day.
      addExpenseQueryParams: isSamePeriod(period, this.today) ? {} : { expenseDate: firstDayOfPeriod(period) }
    };
  }
}
