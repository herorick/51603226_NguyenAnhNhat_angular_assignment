import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, merge } from 'rxjs';

import { BudgetPlanApiService } from '../../../../core/services/budget-plan-api.service';
import { AppError } from '../../../../models/api-error.models';
import { DefaultJarsResponse, JarType } from '../../../../models/budget-plan.models';
import { jarColor } from '../../../../shared/constants/jar-colors';
import { normalizeVndInput, positiveWholeVndValidator } from '../../../../shared/utils/vnd-amount';
import { Period, parsePeriod, periodValidator } from '../../utils/period';

export type DefaultJarsStatus = 'loading' | 'ready' | 'error';

export interface PlanConflict {
  message: string;
  year: number;
  month: number;
}

interface ServerFieldErrors {
  period: string | null;
  monthlyIncomeVnd: string | null;
}

export const PERIOD_ERROR_MESSAGE = 'Select a month for this plan.';
export const INCOME_ERROR_MESSAGE = 'Income must be a positive whole-VND amount.';
export const INVALID_SUMMARY_MESSAGE = 'Please select a month and enter a positive whole-VND income.';
export const SUBMITTING_MESSAGE = 'Creating your monthly plan…';
export const CREATE_FAILED_MESSAGE = 'We could not create your plan. Your values are kept, please try again.';

@Component({
  selector: 'app-monthly-planning-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './monthly-planning-page.component.html',
  styleUrl: './monthly-planning-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthlyPlanningPageComponent {
  private readonly api = inject(BudgetPlanApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly periodInput = viewChild<ElementRef<HTMLInputElement>>('periodInput');
  private readonly incomeInput = viewChild<ElementRef<HTMLInputElement>>('incomeInput');

  readonly form = inject(NonNullableFormBuilder).group({
    period: ['', [Validators.required, periodValidator]],
    monthlyIncomeVnd: ['', [Validators.required, positiveWholeVndValidator]]
  });

  readonly defaultJarsStatus = signal<DefaultJarsStatus>('loading');
  readonly defaultJars = signal<DefaultJarsResponse | null>(null);
  readonly submitting = signal(false);
  readonly attempted = signal(false);
  readonly conflict = signal<PlanConflict | null>(null);
  readonly submitError = signal<string | null>(null);
  private readonly serverPeriodError = signal<string | null>(null);
  private readonly serverIncomeError = signal<string | null>(null);
  /** True from a successful create until the router settles, so the form cannot be submitted twice in that gap. */
  private navigating = false;

  /** Bridges the non-signal form state into signals so zoneless OnPush views refresh on every form event. */
  private readonly formEvents = toSignal(
    // The group only emits `touched` for its first touched child, so listen to each control as well.
    merge(this.form.events, this.form.controls.period.events, this.form.controls.monthlyIncomeVnd.events),
    { initialValue: null }
  );

  readonly submitDisabled = computed(() => this.defaultJarsStatus() !== 'ready' || this.submitting());

  readonly periodError = computed(() => {
    this.formEvents();
    const control = this.form.controls.period;
    if (control.invalid && (control.touched || this.attempted())) {
      return PERIOD_ERROR_MESSAGE;
    }
    return this.serverPeriodError();
  });

  readonly incomeError = computed(() => {
    this.formEvents();
    const control = this.form.controls.monthlyIncomeVnd;
    if (control.invalid && (control.touched || this.attempted())) {
      return INCOME_ERROR_MESSAGE;
    }
    return this.serverIncomeError();
  });

  readonly statusMessage = computed(() => {
    this.formEvents();
    if (this.submitting()) {
      return SUBMITTING_MESSAGE;
    }
    return this.attempted() && this.form.invalid ? INVALID_SUMMARY_MESSAGE : '';
  });

  constructor() {
    this.form.controls.period.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.conflict.set(null);
      this.serverPeriodError.set(null);
    });
    this.form.controls.monthlyIncomeVnd.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.serverIncomeError.set(null);
    });
    this.loadDefaultJars();
  }

  loadDefaultJars(): void {
    this.defaultJarsStatus.set('loading');
    this.api
      .getDefaultJars()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.defaultJars.set(response);
          this.defaultJarsStatus.set('ready');
        },
        error: () => this.defaultJarsStatus.set('error')
      });
  }

  jarColor(jarType: JarType): string {
    return jarColor(jarType);
  }

  submit(): void {
    if (this.submitting() || this.defaultJarsStatus() !== 'ready') {
      return;
    }

    this.attempted.set(true);
    const period = parsePeriod(this.form.controls.period.value);
    if (this.form.invalid || !period) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.conflict.set(null);
    this.submitError.set(null);
    this.serverPeriodError.set(null);
    this.serverIncomeError.set(null);
    this.submitting.set(true);

    this.api
      .createMonthlyPlan({
        year: period.year,
        month: period.month,
        monthlyIncomeVnd: normalizeVndInput(this.form.controls.monthlyIncomeVnd.value)
      })
      .pipe(
        finalize(() => {
          if (!this.navigating) {
            this.submitting.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.openPlan(period),
        error: (error: AppError) => this.handleCreateError(error, period)
      });
  }

  private openPlan(period: Period): void {
    this.navigating = true;
    void this.router.navigate(['/monthly-plans', period.year, period.month]).finally(() => {
      this.navigating = false;
      this.submitting.set(false);
    });
  }

  private handleCreateError(error: AppError, period: Period): void {
    if (error.kind === 'conflict') {
      this.conflict.set({ message: error.message, year: period.year, month: period.month });
      return;
    }

    if (error.kind === 'validation') {
      const mapped = this.mapFieldErrors(error);
      if (mapped.period !== null || mapped.monthlyIncomeVnd !== null) {
        this.serverPeriodError.set(mapped.period);
        this.serverIncomeError.set(mapped.monthlyIncomeVnd);
        this.focusFirstInvalid(mapped.period !== null);
        return;
      }
    }

    this.submitError.set(error.kind === 'validation' ? error.message : CREATE_FAILED_MESSAGE);
  }

  /** Maps API `errors[].field` (`year`, `month`, `monthlyIncomeVnd`) to the form controls; first message wins. */
  private mapFieldErrors(error: AppError): ServerFieldErrors {
    const mapped: ServerFieldErrors = { period: null, monthlyIncomeVnd: null };
    for (const fieldError of error.fieldErrors) {
      if (fieldError.field === 'year' || fieldError.field === 'month') {
        mapped.period ??= fieldError.message;
      } else if (fieldError.field === 'monthlyIncomeVnd') {
        mapped.monthlyIncomeVnd ??= fieldError.message;
      }
    }
    return mapped;
  }

  private focusFirstInvalid(periodHasServerError = false): void {
    const periodInvalid = this.form.controls.period.invalid || periodHasServerError;
    (periodInvalid ? this.periodInput() : this.incomeInput())?.nativeElement.focus();
  }
}
