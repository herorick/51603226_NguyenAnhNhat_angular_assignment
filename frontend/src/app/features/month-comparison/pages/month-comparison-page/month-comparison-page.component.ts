import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';

import { BudgetPlanApiService } from '../../../../core/services/budget-plan-api.service';
import { AppError } from '../../../../models/api-error.models';
import { JarType, MonthComparisonResponse } from '../../../../models/budget-plan.models';
import { JAR_COLOR_TOKEN } from '../../../../shared/constants/jar-colors';
import {
  Period,
  currentPeriod,
  formatPeriodInput,
  formatPeriodLabel,
  parsePeriod,
  shiftPeriod
} from '../../../monthly-planning/utils/period';
import {
  ComparisonQuery,
  DEFAULT_RANGE,
  RANGE_OPTIONS,
  buildComparisonView,
  isRangeOption
} from '../../utils/comparison-chart';

export type MonthComparisonState =
  | { status: 'loading' }
  | { status: 'ready'; response: MonthComparisonResponse }
  | { status: 'error'; message: string };

export const COMPARISON_LOAD_FAILED_MESSAGE = 'We could not load the month comparison. Please try again.';
export const COMPARISON_INVALID_MESSAGE = 'The comparison data is incomplete. Please try again.';

const isJarType = (value: string | null): value is JarType => value !== null && Object.hasOwn(JAR_COLOR_TOKEN, value);

/** Reads `?end=YYYY-MM&months=N&jar=type`; anything missing or invalid falls back to this month, 6 months, all jars. */
export const parseComparisonQuery = (params: ParamMap, today: Period = currentPeriod()): ComparisonQuery => {
  const end = parsePeriod(params.get('end') ?? '') ?? today;
  const months = Number(params.get('months'));
  const jar = params.get('jar');
  return { end, months: isRangeOption(months) ? months : DEFAULT_RANGE, jar: isJarType(jar) ? jar : null };
};

const isValidResponse = (response: MonthComparisonResponse | null, query: ComparisonQuery): boolean =>
  response !== null &&
  typeof response === 'object' &&
  Array.isArray(response.jars) &&
  Array.isArray(response.months) &&
  response.months.length === query.months &&
  response.months.every((month) => Array.isArray(month.jars)) &&
  response.months.at(-1)?.year === query.end.year &&
  response.months.at(-1)?.month === query.end.month;

/**
 * Compares spending by jar across consecutive months: a stacked column chart (one column per month, one colour per
 * jar, with the income or jar budget drawn as an outline) and the same numbers as a table. The range and the jar
 * filter live in the query string, so a comparison can be bookmarked or shared.
 */
@Component({
  selector: 'app-month-comparison-page',
  imports: [RouterLink],
  templateUrl: './month-comparison-page.component.html',
  styleUrl: './month-comparison-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthComparisonPageComponent {
  private readonly api = inject(BudgetPlanApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reloads = new Subject<void>();

  readonly rangeOptions = RANGE_OPTIONS;

  readonly query = toSignal(this.route.queryParamMap.pipe(map((params) => parseComparisonQuery(params))), {
    initialValue: parseComparisonQuery(this.route.snapshot.queryParamMap)
  });

  readonly state = signal<MonthComparisonState>({ status: 'loading' });
  readonly status = computed(() => this.state().status);
  readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.message : '';
  });

  readonly endInput = computed(() => formatPeriodInput(this.query().end));
  readonly rangeLabel = computed(() => {
    const { end, months } = this.query();
    const start = shiftPeriod(end, -(months - 1));
    return start ? `${formatPeriodLabel(start)} – ${formatPeriodLabel(end)}` : formatPeriodLabel(end);
  });

  readonly jarOptions = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.response.jars : [];
  });

  readonly view = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? buildComparisonView(state.response, this.query().jar) : null;
  });

  constructor() {
    // The jar filter is applied on the client, so only the end month and the range trigger a request.
    this.route.queryParamMap
      .pipe(
        map((params) => parseComparisonQuery(params)),
        distinctUntilChanged(
          (a, b) => a.end.year === b.end.year && a.end.month === b.end.month && a.months === b.months
        ),
        switchMap((query) =>
          this.reloads.pipe(
            startWith(undefined),
            switchMap(() => this.load(query))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((state) => this.state.set(state));
  }

  retry(): void {
    this.reloads.next();
  }

  onEndChange(value: string): void {
    const end = parsePeriod(value);
    if (end) {
      this.updateQuery({ end: formatPeriodInput(end) });
    }
  }

  onRangeChange(value: string): void {
    const months = Number(value);
    if (isRangeOption(months)) {
      this.updateQuery({ months });
    }
  }

  onJarChange(value: string): void {
    this.updateQuery({ jar: isJarType(value) ? value : null });
  }

  /** Moves the whole window by one range length, e.g. the 6 months before the current ones. */
  shift(direction: -1 | 1): void {
    const { end, months } = this.query();
    const next = shiftPeriod(end, direction * months);
    if (next) {
      this.updateQuery({ end: formatPeriodInput(next) });
    }
  }

  private updateQuery(patch: Record<string, string | number | null>): void {
    const { end, months, jar } = this.query();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { end: formatPeriodInput(end), months, jar, ...patch },
      replaceUrl: true
    });
  }

  private load(query: ComparisonQuery): Observable<MonthComparisonState> {
    return this.api.getMonthComparison(query.end.year, query.end.month, query.months).pipe(
      map(
        (response): MonthComparisonState =>
          isValidResponse(response, query)
            ? { status: 'ready', response }
            : { status: 'error', message: COMPARISON_INVALID_MESSAGE }
      ),
      catchError((error: AppError) =>
        of<MonthComparisonState>({
          status: 'error',
          message: error.kind === 'network' ? error.message : COMPARISON_LOAD_FAILED_MESSAGE
        })
      ),
      startWith<MonthComparisonState>({ status: 'loading' })
    );
  }
}
