import { DecimalPipe } from '@angular/common';
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
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  finalize,
  map,
  merge,
  of,
  skip,
  startWith,
  switchMap,
  tap,
  timer
} from 'rxjs';

import { BudgetPlanApiService } from '../../../../core/services/budget-plan-api.service';
import { AppError } from '../../../../models/api-error.models';
import {
  CreateExpenseRequest,
  CreateExpenseResponse,
  JarType,
  MonthlyPlanResponse
} from '../../../../models/budget-plan.models';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { isZeroWholeVnd, normalizeVndInput, positiveWholeVndValidator } from '../../../../shared/utils/vnd-amount';
import { Period, formatPeriodLabel } from '../../../monthly-planning/utils/period';
import { isValidMonthlyPlan } from '../../../monthly-planning/utils/plan-shape';
import {
  MAX_DESCRIPTION_LENGTH,
  descriptionValidator,
  expenseDateValidator,
  formatExpenseDate,
  parseExpenseDate
} from '../../utils/expense-form';

export type PlanStatus = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';

/** One variant per status, so the jars exist only in `ready` and a failed load can never leave stale jars behind. */
export type PlanView =
  | { status: 'idle' }
  | { status: 'loading'; period: Period }
  | { status: 'ready'; period: Period; plan: MonthlyPlanResponse }
  | { status: 'not-found'; period: Period }
  | { status: 'error'; period: Period; message: string };

export type FormField = 'expenseDate' | 'jarType' | 'amountVnd' | 'description';

type ServerErrors = Partial<Record<FormField, string>>;

/** Field order on the page: first invalid field gets the focus. */
const FORM_FIELDS: readonly FormField[] = ['expenseDate', 'jarType', 'amountVnd', 'description'];

export const PLAN_NOT_FOUND_CODE = 'MONTHLY_PLAN_NOT_FOUND';
export const JAR_NOT_IN_PLAN_CODE = 'JAR_NOT_IN_MONTHLY_PLAN';

export const DATE_ERROR_MESSAGE = 'Select a valid expense date.';
export const JAR_ERROR_MESSAGE = 'Please select a jar.';
export const AMOUNT_ERROR_MESSAGE = 'Enter a positive whole-VND amount.';
export const AMOUNT_ZERO_MESSAGE = 'Amount must be greater than zero.';
export const DESCRIPTION_REQUIRED_MESSAGE = 'Description is required.';
export const DESCRIPTION_TOO_LONG_MESSAGE = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
export const INVALID_SUMMARY_MESSAGE = 'Please complete the required expense details.';
export const SAVING_MESSAGE = 'Saving your expense…';
export const SAVE_FAILED_MESSAGE = 'We could not save your expense. Your values are kept, please try again.';
export const PLAN_UNAVAILABLE_MESSAGE =
  'The jars for this month are not available, so the expense cannot be saved yet.';
export const PLAN_LOAD_FAILED_MESSAGE = 'We could not load the jars for this month. Please try again.';
export const INTEGRITY_ERROR_MESSAGE = 'The monthly plan data is incomplete or invalid. Please try again.';

/**
 * How long the date must stay unchanged before the plan GET is sent. A date input emits every intermediate year while
 * it is typed (0002, 0020, 0202, 2026), and each one would otherwise be a request and a flash of "no plan".
 */
export const PLAN_LOAD_DELAY_MS = 300;

/** One request to show a month: `delayMs` is 0 for the first load and for a retry, which the user waits on. */
interface PlanLoad {
  period: Period | null;
  delayMs: number;
}

const periodKey = (period: Period | null): string => (period ? `${period.year}-${period.month}` : '');
const samePeriod = (previous: Period | null, next: Period | null): boolean => periodKey(previous) === periodKey(next);

const initialExpenseDate = (route: ActivatedRoute): string => {
  const fromQuery = route.snapshot.queryParamMap.get('expenseDate');
  return fromQuery !== null && parseExpenseDate(fromQuery) ? fromQuery : formatExpenseDate(new Date());
};

@Component({
  selector: 'app-add-expense-page',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, VndPipe],
  templateUrl: './add-expense-page.component.html',
  styleUrl: './add-expense-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddExpensePageComponent {
  private readonly api = inject(BudgetPlanApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloads = new Subject<void>();

  private readonly dateInput = viewChild<ElementRef<HTMLElement>>('dateInput');
  private readonly jarSelect = viewChild<ElementRef<HTMLElement>>('jarSelect');
  private readonly amountInput = viewChild<ElementRef<HTMLElement>>('amountInput');
  private readonly descriptionInput = viewChild<ElementRef<HTMLElement>>('descriptionInput');

  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    expenseDate: [initialExpenseDate(this.route), [expenseDateValidator]],
    jarType: this.fb.control<JarType | ''>('', Validators.required),
    amountVnd: ['', [positiveWholeVndValidator]],
    description: ['', [descriptionValidator]]
  });
  /** The same controls keyed by field name, typed as plain `AbstractControl` so they can be iterated uniformly. */
  private readonly controls: Record<FormField, AbstractControl> = this.form.controls;

  readonly planView = signal<PlanView>({ status: 'idle' });
  readonly saving = signal(false);
  readonly attempted = signal(false);
  /** The last 201 body. Cleared on a new submit and when the date moves to another month. */
  readonly saved = signal<CreateExpenseResponse | null>(null);
  readonly submitError = signal<string | null>(null);
  private readonly serverErrors = signal<ServerErrors>({});
  /** `?jarType=` from the entry link: applied once, and only if that jar exists in the loaded plan. */
  private pendingJarType = this.route.snapshot.queryParamMap.get('jarType');

  /**
   * Bridges the non-signal form state into signals so zoneless OnPush views refresh on every form event.
   * Silent changes (`emitEvent: false`) do not emit here; the computeds that depend on them also read `planView`.
   */
  private readonly formEvents = toSignal(
    merge(this.form.events, ...Object.values(this.controls).map((control) => control.events)),
    { initialValue: null }
  );

  readonly planStatus = computed<PlanStatus>(() => this.planView().status);

  readonly plan = computed<MonthlyPlanResponse | null>(() => {
    const view = this.planView();
    return view.status === 'ready' ? view.plan : null;
  });

  /** Jar options come only from the loaded plan, in the order the API returned them. */
  readonly jars = computed(() => this.plan()?.jars ?? []);

  readonly planErrorMessage = computed(() => {
    const view = this.planView();
    return view.status === 'error' ? view.message : '';
  });

  /** `September 2026` for the missing-plan message, or an empty string while no month is loaded. */
  readonly planPeriodLabel = computed(() => {
    const view = this.planView();
    return view.status === 'idle' ? '' : formatPeriodLabel(view.period);
  });

  readonly saveDisabled = computed(() => this.saving() || this.planStatus() === 'loading');

  readonly selectedJar = computed(() => {
    this.formEvents();
    const type = this.form.controls.jarType.value;
    return this.plan()?.jars.find((jar) => jar.jarType === type) ?? null;
  });

  /** Backend totals for the selected jar, shown only while that jar is still the one that was just saved. */
  readonly selectedJarSummary = computed(() => {
    const saved = this.saved();
    const jar = this.selectedJar();
    const view = this.planView();
    if (!saved || !jar || view.status !== 'ready') {
      return null;
    }
    // A 201 can arrive after the date moved on: its totals belong to the month it was saved in, not the loaded one.
    const sameMonth = periodKey(parseExpenseDate(saved.expense.expenseDate)) === periodKey(view.period);
    return sameMonth && saved.jarSummary.jarType === jar.jarType ? saved.jarSummary : null;
  });

  /** Display flag from the sign the backend returned; no arithmetic on money. */
  readonly overBudget = computed(() => this.selectedJarSummary()?.remainingVnd.startsWith('-') ?? false);

  readonly expenseDateError = computed(() => {
    this.formEvents();
    const control = this.form.controls.expenseDate;
    return control.invalid && this.shouldShow(control) ? DATE_ERROR_MESSAGE : (this.serverErrors().expenseDate ?? null);
  });

  readonly jarError = computed(() => {
    this.formEvents();
    this.planView();
    const control = this.form.controls.jarType;
    return control.invalid && this.shouldShow(control) ? JAR_ERROR_MESSAGE : (this.serverErrors().jarType ?? null);
  });

  readonly amountError = computed(() => {
    this.formEvents();
    const control = this.form.controls.amountVnd;
    if (control.invalid && this.shouldShow(control)) {
      return isZeroWholeVnd(normalizeVndInput(control.value)) ? AMOUNT_ZERO_MESSAGE : AMOUNT_ERROR_MESSAGE;
    }
    return this.serverErrors().amountVnd ?? null;
  });

  readonly descriptionError = computed(() => {
    this.formEvents();
    const control = this.form.controls.description;
    if (control.invalid && this.shouldShow(control)) {
      return control.hasError('maxlength') ? DESCRIPTION_TOO_LONG_MESSAGE : DESCRIPTION_REQUIRED_MESSAGE;
    }
    return this.serverErrors().description ?? null;
  });

  readonly statusMessage = computed(() => {
    this.formEvents();
    this.planView();
    if (this.saving()) {
      return SAVING_MESSAGE;
    }
    if (this.attempted() && this.form.invalid) {
      return INVALID_SUMMARY_MESSAGE;
    }
    const status = this.planStatus();
    return this.attempted() && (status === 'not-found' || status === 'error') ? PLAN_UNAVAILABLE_MESSAGE : '';
  });

  /** Points the jar select at the plan alert while its options are missing, so the disabled state has a reason. */
  readonly jarDescribedBy = computed(() => {
    if (this.jarError()) {
      return 'expense-jar-error';
    }
    const status = this.planStatus();
    return status === 'not-found' || status === 'error' ? 'expense-plan-alert' : null;
  });

  constructor() {
    for (const field of FORM_FIELDS) {
      this.controls[field].valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.clearServerError(field));
    }

    const dateControl = this.form.controls.expenseDate;
    const currentPeriod = (): Period | null => parseExpenseDate(dateControl.value);

    // Only a change of year or month reloads the plan (`distinctUntilChanged`). The new month shows `loading` at once,
    // so the old jars are locked immediately, but its GET waits for the typing to settle. `switchMap` drops the pending
    // timer or in-flight GET on the next change or retry, so a stale response never overwrites a newer one.
    const dateChanges$ = dateControl.valueChanges.pipe(
      map(parseExpenseDate),
      startWith(currentPeriod()),
      distinctUntilChanged(samePeriod),
      skip(1),
      tap(() => {
        this.saved.set(null);
        this.submitError.set(null);
      }),
      map((period): PlanLoad => ({ period, delayMs: PLAN_LOAD_DELAY_MS }))
    );
    const retries$ = this.reloads.pipe(map((): PlanLoad => ({ period: currentPeriod(), delayMs: 0 })));

    merge(of<PlanLoad>({ period: currentPeriod(), delayMs: 0 }), dateChanges$, retries$)
      .pipe(
        switchMap(({ period, delayMs }) => this.loadPlan(period, delayMs)),
        takeUntilDestroyed()
      )
      .subscribe((view) => this.applyPlanView(view));
  }

  /** Re-runs the plan GET for the current date. Only offered from the error state, so it cannot double fire. */
  retryPlan(): void {
    this.reloads.next();
  }

  submit(): void {
    if (this.saveDisabled()) {
      return;
    }

    this.attempted.set(true);
    const raw = this.form.getRawValue();
    // `find` returns the plan's own `jarType`, which narrows the `JarType | ''` control value without a cast.
    const jar = this.plan()?.jars.find((candidate) => candidate.jarType === raw.jarType);
    if (this.form.invalid || !jar) {
      this.form.markAllAsTouched();
      this.focusField(FORM_FIELDS.find((field) => this.controls[field].invalid) ?? 'expenseDate');
      return;
    }

    const request: CreateExpenseRequest = {
      expenseDate: raw.expenseDate,
      jarType: jar.jarType,
      amountVnd: normalizeVndInput(raw.amountVnd),
      description: raw.description.trim()
    };
    this.saved.set(null);
    this.submitError.set(null);
    this.serverErrors.set({});
    this.saving.set(true);

    this.api
      .createExpense(request)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => this.handleSaved(response, request),
        error: (error: AppError) => this.handleSaveError(error, request)
      });
  }

  private shouldShow(control: AbstractControl): boolean {
    return control.touched || this.attempted();
  }

  private loadPlan(period: Period | null, delayMs: number): Observable<PlanView> {
    if (!period) {
      return of<PlanView>({ status: 'idle' });
    }
    const plan$ = this.api.getMonthlyPlan(period.year, period.month).pipe(
      map((plan): PlanView =>
        // The jars must belong to the month the date points at, so a body for another month is rejected.
        isValidMonthlyPlan(plan) && plan.year === period.year && plan.month === period.month
          ? { status: 'ready', period, plan }
          : { status: 'error', period, message: INTEGRITY_ERROR_MESSAGE }
      ),
      catchError((error: AppError) => of(this.toFailureView(period, error)))
    );
    return (delayMs > 0 ? timer(delayMs).pipe(switchMap(() => plan$)) : plan$).pipe(
      startWith<PlanView>({ status: 'loading', period })
    );
  }

  private toFailureView(period: Period, error: AppError): PlanView {
    if (error.kind === 'not-found' && error.code === PLAN_NOT_FOUND_CODE) {
      return { status: 'not-found', period };
    }
    // Only a network failure keeps its own (already generic) message; every other failure gets the page message.
    return { status: 'error', period, message: error.kind === 'network' ? error.message : PLAN_LOAD_FAILED_MESSAGE };
  }

  /**
   * Publishes a plan state and syncs the jar control with it. The jar is locked while no plan is ready, but its value
   * is kept, so retyping the date or a failed load does not lose the choice. Options come only from the ready plan,
   * and the value is checked against that plan, so another month's jars are never reused.
   */
  private applyPlanView(view: PlanView): void {
    this.planView.set(view);
    const jar = this.form.controls.jarType;

    if (view.status !== 'ready') {
      jar.disable({ emitEvent: false });
      return;
    }

    jar.enable({ emitEvent: false });
    jar.setValue(this.resolveJar(view.plan, jar.value), { emitEvent: false });
    // Kept through a failed load, so "Try again" still restores the jar from the entry link.
    this.pendingJarType = null;
  }

  private resolveJar(plan: MonthlyPlanResponse, current: JarType | ''): JarType | '' {
    const inPlan = (type: string | null): JarType | undefined => plan.jars.find((jar) => jar.jarType === type)?.jarType;
    return inPlan(current) ?? inPlan(this.pendingJarType) ?? '';
  }

  private handleSaved(response: CreateExpenseResponse, request: CreateExpenseRequest): void {
    this.saved.set(response);
    this.attempted.set(false);
    // Date and jar stay so the next expense for the same jar is quick to enter. The amount and description are
    // cleared only while they still hold what was saved, so text typed during the save is never wiped.
    const { amountVnd, description } = this.form.controls;
    if (normalizeVndInput(amountVnd.value) === request.amountVnd) {
      amountVnd.reset('');
    }
    if (description.value.trim() === request.description) {
      description.reset('');
    }
  }

  private handleSaveError(error: AppError, request: CreateExpenseRequest): void {
    const view = this.planView();
    // A failure says something about the page only if the date still points at the month that was submitted.
    // Otherwise it is reported generically: field errors and the missing-plan state would land on the wrong month.
    if (view.status === 'idle' || periodKey(view.period) !== periodKey(parseExpenseDate(request.expenseDate))) {
      this.submitError.set(SAVE_FAILED_MESSAGE);
      return;
    }

    if (error.kind === 'validation') {
      this.handleValidationError(error);
      return;
    }

    if (error.kind === 'not-found' && error.code === PLAN_NOT_FOUND_CODE) {
      this.applyPlanView({ status: 'not-found', period: view.period });
      return;
    }

    this.submitError.set(SAVE_FAILED_MESSAGE);
  }

  private handleValidationError(error: AppError): void {
    if (error.code === JAR_NOT_IN_PLAN_CODE) {
      // The plan the page holds is out of date: show the error, then reload so the options match the server.
      this.serverErrors.set({ jarType: error.message });
      this.reloads.next();
      return;
    }

    const mapped = this.mapFieldErrors(error);
    const firstField = FORM_FIELDS.find((field) => mapped[field] !== undefined);
    if (firstField === undefined) {
      this.submitError.set(error.message);
      return;
    }
    this.serverErrors.set(mapped);
    this.focusField(firstField);
  }

  /** Maps API `errors[].field` to the form controls; the first message per field wins. */
  private mapFieldErrors(error: AppError): ServerErrors {
    const mapped: ServerErrors = {};
    for (const fieldError of error.fieldErrors) {
      const field = FORM_FIELDS.find((candidate) => candidate === fieldError.field);
      if (field !== undefined) {
        mapped[field] ??= fieldError.message;
      }
    }
    return mapped;
  }

  private clearServerError(field: FormField): void {
    this.serverErrors.update((errors) => {
      if (errors[field] === undefined) {
        return errors;
      }
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }

  private focusField(field: FormField): void {
    const targets: Record<FormField, ElementRef<HTMLElement> | undefined> = {
      expenseDate: this.dateInput(),
      jarType: this.jarSelect(),
      amountVnd: this.amountInput(),
      description: this.descriptionInput()
    };
    targets[field]?.nativeElement.focus();
  }
}
