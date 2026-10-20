import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { BudgetPlanApiService } from '../../../../core/services/budget-plan-api.service';
import { AppError } from '../../../../models/api-error.models';
import { JarType, MonthlyPlanResponse } from '../../../../models/budget-plan.models';
import { jarColor } from '../../../../shared/constants/jar-colors';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { Period, firstDayOfPeriod, formatPeriodLabel, parseRoutePeriod } from '../../utils/period';
import { isValidMonthlyPlan } from '../../utils/plan-shape';

export type MonthlyPlanStatus = 'loading' | 'ready' | 'not-found' | 'error' | 'invalid-period';

/** One variant per status, so amounts exist only in `ready` and a failed load can never leave stale numbers behind. */
export type MonthlyPlanView =
  | { status: 'invalid-period' }
  | { status: 'loading'; period: Period | null }
  | { status: 'ready'; period: Period; plan: MonthlyPlanResponse }
  | { status: 'not-found'; period: Period }
  | { status: 'error'; period: Period; message: string };

/** One slice of the donut. `length` and `offset` are visual units on a circle of circumference 100. */
export interface DonutSegment {
  jarType: JarType;
  length: number;
  offset: number;
  color: string;
}

export const PLAN_NOT_FOUND_CODE = 'MONTHLY_PLAN_NOT_FOUND';
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
export const LOAD_FAILED_MESSAGE = 'We could not load this monthly plan. Please try again.';
export const INTEGRITY_ERROR_MESSAGE = 'The monthly plan data is incomplete or invalid. Please try again.';

@Component({
  selector: 'app-monthly-plan-page',
  imports: [DecimalPipe, RouterLink, VndPipe],
  templateUrl: './monthly-plan-page.component.html',
  styleUrl: './monthly-plan-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthlyPlanPageComponent {
  private readonly api = inject(BudgetPlanApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly reloads = new Subject<void>();

  readonly view = signal<MonthlyPlanView>({ status: 'loading', period: null });

  readonly status = computed<MonthlyPlanStatus>(() => this.view().status);

  readonly period = computed<Period | null>(() => {
    const view = this.view();
    return view.status === 'invalid-period' ? null : view.period;
  });

  readonly plan = computed<MonthlyPlanResponse | null>(() => {
    const view = this.view();
    return view.status === 'ready' ? view.plan : null;
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

  /**
   * Donut slices from the backend `percentage` values. The running offset only positions each slice on the ring:
   * nothing here is shown as a total and no budget or percentage is derived from it.
   */
  readonly donutSegments = computed<DonutSegment[]>(() => {
    const plan = this.plan();
    if (!plan) {
      return [];
    }
    let offset = 0;
    return plan.jars.map((jar) => {
      const segment: DonutSegment = {
        jarType: jar.jarType,
        length: jar.percentage,
        offset,
        color: jarColor(jar.jarType)
      };
      offset += jar.percentage;
      return segment;
    });
  });

  constructor() {
    // `switchMap` drops the in-flight GET when the route params change or the user retries, so a stale response
    // can never overwrite a newer one. The page is reused by the router when only `:year/:month` changes.
    combineLatest([this.route.paramMap, this.reloads.pipe(startWith(undefined))])
      .pipe(
        switchMap(([params]) => this.load(parseRoutePeriod(params.get('year'), params.get('month')))),
        takeUntilDestroyed()
      )
      .subscribe((view) => this.view.set(view));
  }

  /** Re-runs the GET for the current route params. Only offered from the error state, so it cannot double fire. */
  retry(): void {
    this.reloads.next();
  }

  jarColor(jarType: JarType): string {
    return jarColor(jarType);
  }

  private load(period: Period | null): Observable<MonthlyPlanView> {
    if (!period) {
      return of<MonthlyPlanView>({ status: 'invalid-period' });
    }
    return this.api.getMonthlyPlan(period.year, period.month).pipe(
      map((plan): MonthlyPlanView =>
        // The page labels the plan from the route, so a body for another month must not render under this one.
        isValidMonthlyPlan(plan) && plan.year === period.year && plan.month === period.month
          ? { status: 'ready', period, plan }
          : { status: 'error', period, message: INTEGRITY_ERROR_MESSAGE }
      ),
      catchError((error: AppError) => of(this.toFailureView(period, error))),
      startWith<MonthlyPlanView>({ status: 'loading', period })
    );
  }

  private toFailureView(period: Period, error: AppError): MonthlyPlanView {
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
