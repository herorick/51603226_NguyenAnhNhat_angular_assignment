import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { BudgetPlanApiService } from '../../../../core/services/budget-plan-api.service';
import { AppError } from '../../../../models/api-error.models';
import { JarType, SpendingByJar, SpendingByJarsResponse } from '../../../../models/budget-plan.models';
import { jarColor } from '../../../../shared/constants/jar-colors';
import { formatVnd } from '../../../../shared/pipes/vnd.pipe';
import { Period, firstDayOfPeriod, formatPeriodLabel, parseRoutePeriod } from '../../../monthly-planning/utils/period';
import { EXPECTED_JAR_COUNT, isValidSpendingByJars } from '../../utils/spending-shape';

export type SpendingByJarStatus = 'loading' | 'ready' | 'not-found' | 'error' | 'invalid-period';

/** One variant per status, so amounts exist only in `ready` and a failed load can never leave stale numbers behind. */
export type SpendingByJarView =
  | { status: 'invalid-period' }
  | { status: 'loading'; period: Period | null }
  | { status: 'ready'; period: Period; spending: SpendingByJarsResponse }
  | { status: 'not-found'; period: Period }
  | { status: 'error'; period: Period; message: string };

/** Display model of one jar row. Every value comes from the API or is formatting of it. */
export interface SpendingRow {
  jarType: JarType;
  jarName: string;
  color: string;
  spentText: string;
  plannedText: string;
  /** Backend `percentageUsed`, at most 2 decimals, never clamped: `125.5%`. */
  percentLabel: string;
  /** Visual only: `percentageUsed` capped at 100 so the fill stays inside the track. */
  barWidth: number;
  overBudget: boolean;
  /** Same cap as `barWidth`, because `aria-valuenow` must stay inside `aria-valuemin`/`aria-valuemax`. */
  ariaValueNow: number;
  ariaValueText: string;
  ariaLabel: string;
}

export const PLAN_NOT_FOUND_CODE = 'MONTHLY_PLAN_NOT_FOUND';
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
export const LOAD_FAILED_MESSAGE = 'We could not load the spending by jar. Please try again.';
export const INTEGRITY_ERROR_MESSAGE = 'The spending data is incomplete or invalid. Please try again.';

const PERCENT_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

@Component({
  selector: 'app-spending-by-jar-page',
  imports: [RouterLink],
  templateUrl: './spending-by-jar-page.component.html',
  styleUrl: './spending-by-jar-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpendingByJarPageComponent {
  private readonly api = inject(BudgetPlanApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly reloads = new Subject<void>();

  readonly view = signal<SpendingByJarView>({ status: 'loading', period: null });

  readonly status = computed<SpendingByJarStatus>(() => this.view().status);

  readonly period = computed<Period | null>(() => {
    const view = this.view();
    return view.status === 'invalid-period' ? null : view.period;
  });

  readonly errorMessage = computed(() => {
    const view = this.view();
    return view.status === 'error' ? view.message : '';
  });

  /** `September 2026`, or an empty string while there is no valid period. */
  readonly periodLabel = computed(() => {
    const period = this.period();
    return period ? formatPeriodLabel(period) : '';
  });

  readonly addExpenseQueryParams = computed(() => {
    const period = this.period();
    return period ? { expenseDate: firstDayOfPeriod(period) } : {};
  });

  /** Rows in the order the API returned them. No sorting, and no percentage or total is computed here. */
  readonly rows = computed<SpendingRow[]>(() => {
    const view = this.view();
    return view.status === 'ready' ? view.spending.jars.map(toRow) : [];
  });

  /** The loading state reserves one skeleton row per jar, so the layout does not jump when data arrives. */
  readonly skeletonRows = Array.from({ length: EXPECTED_JAR_COUNT }, (_, index) => index);

  constructor() {
    // `switchMap` drops the in-flight GET when the route params change or the user retries, so a stale response
    // can never overwrite a newer one. The router reuses this page when only `:year/:month` changes.
    // The page is also re-created on every navigation, so each visit refetches and shows fresh expenses.
    combineLatest([this.route.paramMap, this.reloads.pipe(startWith(undefined))])
      .pipe(
        switchMap(([params]) => this.load(parseRoutePeriod(params.get('year'), params.get('month')))),
        takeUntilDestroyed()
      )
      .subscribe((view) => this.view.set(view));
  }

  /** Re-runs the GET for the current route params. Only offered from the error state; `switchMap` cancels a duplicate. */
  retry(): void {
    this.reloads.next();
  }

  private load(period: Period | null): Observable<SpendingByJarView> {
    if (!period) {
      return of<SpendingByJarView>({ status: 'invalid-period' });
    }
    return this.api.getSpendingByJars(period.year, period.month).pipe(
      map((spending): SpendingByJarView =>
        // The page labels the data from the route, so a body for another month must not render under this one.
        isValidSpendingByJars(spending) && spending.year === period.year && spending.month === period.month
          ? { status: 'ready', period, spending }
          : { status: 'error', period, message: INTEGRITY_ERROR_MESSAGE }
      ),
      catchError((error: AppError) => of(this.toFailureView(period, error))),
      startWith<SpendingByJarView>({ status: 'loading', period })
    );
  }

  private toFailureView(period: Period, error: AppError): SpendingByJarView {
    if (error.kind === 'not-found' && error.code === PLAN_NOT_FOUND_CODE) {
      return { status: 'not-found', period };
    }
    if (error.kind === 'validation' && error.code === VALIDATION_ERROR_CODE) {
      return { status: 'invalid-period' };
    }
    // Only a network failure keeps its own (already generic) message; every other failure gets the page message.
    return { status: 'error', period, message: error.kind === 'network' ? error.message : LOAD_FAILED_MESSAGE };
  }
}

const toRow = (jar: SpendingByJar): SpendingRow => {
  const spentText = formatVnd(jar.spentBudgetVnd);
  const plannedText = formatVnd(jar.plannedBudgetVnd);
  const percentLabel = `${PERCENT_FORMAT.format(jar.percentageUsed)}%`;
  const overBudget = jar.percentageUsed > 100;
  const barWidth = Math.min(jar.percentageUsed, 100);
  const ariaValueText = overBudget ? `${percentLabel} used, over budget` : `${percentLabel} used`;
  return {
    jarType: jar.jarType,
    jarName: jar.jarName,
    color: jarColor(jar.jarType),
    spentText,
    plannedText,
    percentLabel,
    barWidth,
    overBudget,
    ariaValueNow: barWidth,
    ariaValueText,
    ariaLabel: `${jar.jarName}: spent ${spentText} of ${plannedText}, ${ariaValueText}`
  };
};
