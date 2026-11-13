import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, catchError, finalize, map, of, startWith, switchMap } from 'rxjs';

import { BudgetPlanApiService } from '../../../../core/services/budget-plan-api.service';
import { AppError } from '../../../../models/api-error.models';
import { CreatedExpense, DefaultJar, JarType } from '../../../../models/budget-plan.models';
import { jarColor } from '../../../../shared/constants/jar-colors';
import { VndAmountInputDirective } from '../../../../shared/directives/vnd-amount-input.directive';
import { VndPipe, formatVnd } from '../../../../shared/pipes/vnd.pipe';
import {
  describeVndInput,
  formatVndInput,
  normalizeVndInput,
  positiveWholeVndValidator
} from '../../../../shared/utils/vnd-amount';
import { descriptionValidator, expenseDateValidator } from '../../../expenses/utils/expense-form';
import { Period, firstDayOfPeriod } from '../../../monthly-planning/utils/period';

export type MonthExpensesView =
  | { status: 'loading' }
  | { status: 'ready'; expenses: CreatedExpense[] }
  | { status: 'error'; message: string };

export const EXPENSES_LOAD_FAILED_MESSAGE = 'We could not load the expenses for this month.';
export const EXPENSE_SAVE_FAILED_MESSAGE = 'We could not save the changes. Please try again.';
export const EXPENSE_DELETE_FAILED_MESSAGE = 'We could not delete this expense. Please try again.';
export const EXPENSE_FORM_INVALID_MESSAGE = 'Check the highlighted fields.';

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DATE = /^\d{4}-(\d{2})-(\d{2})$/;

/**
 * `2026-09-05` -> `05 Sep`. Read straight from the string (no `Date`, so no time-zone shift) and from a fixed name
 * table, because ICU spells September "Sept" in some locales. Anything unexpected is shown as received.
 */
const formatDay = (isoDate: string): string => {
  const match = ISO_DATE.exec(isoDate);
  const month = match ? MONTH_ABBREVIATIONS[Number(match[1]) - 1] : undefined;
  return match && month ? `${match[2]} ${month}` : isoDate;
};

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** `YYYY-MM-<last day>`: upper bound of the date picker while editing an expense of this month. */
export const lastDayOfPeriod = (period: Period): string => {
  const { year, month } = period;
  const leapFebruary = month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0);
  const lastDay = leapFebruary ? 29 : DAYS_IN_MONTH[month - 1];
  return `${firstDayOfPeriod(period).slice(0, 8)}${String(lastDay)}`;
};

/**
 * Every expense recorded in the month, newest first, so the user can see what makes up the jar totals.
 * Each row can be edited in place or deleted; `changed` fires after either, so the page can refresh its jar totals.
 */
@Component({
  selector: 'app-month-expenses',
  imports: [ReactiveFormsModule, VndAmountInputDirective, VndPipe],
  templateUrl: './month-expenses.component.html',
  styleUrl: './month-expenses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthExpensesComponent {
  private readonly api = inject(BudgetPlanApiService);
  private readonly destroyRef = inject(DestroyRef);
  /** `true` = quiet reload after an edit: the current rows stay on screen until the fresh list arrives. */
  private readonly reloads = new Subject<boolean>();

  readonly period = input.required<Period>();
  /** Fires after an expense was updated or deleted. */
  readonly changed = output<void>();

  readonly view = signal<MonthExpensesView>({ status: 'loading' });
  readonly status = computed(() => this.view().status);
  readonly errorMessage = computed(() => {
    const view = this.view();
    return view.status === 'error' ? view.message : '';
  });
  readonly rows = computed(() => {
    const view = this.view();
    return view.status === 'ready'
      ? view.expenses.map((expense) => ({
          ...expense,
          dayLabel: formatDay(expense.expenseDate),
          color: jarColor(expense.jarType)
        }))
      : [];
  });

  /** Id of the row shown as an edit form, or null. */
  readonly editingId = signal<number | null>(null);
  /** Id of the row whose save or delete is in flight; every row action is locked meanwhile. */
  readonly busyId = signal<number | null>(null);
  readonly rowError = signal<{ id: number; message: string } | null>(null);
  readonly notice = signal<string>('');

  /** Jar catalog for the edit form, fetched on the first edit only. */
  private readonly defaultJars = signal<DefaultJar[]>([]);
  private defaultJarsRequested = false;

  readonly form = inject(FormBuilder).nonNullable.group({
    expenseDate: ['', [expenseDateValidator]],
    jarType: ['' as JarType | '', [Validators.required]],
    amountVnd: ['', [positiveWholeVndValidator]],
    description: ['', [descriptionValidator]]
  });

  readonly dateMin = computed(() => firstDayOfPeriod(this.period()));
  readonly dateMax = computed(() => lastDayOfPeriod(this.period()));

  private readonly amountValue = toSignal(this.form.controls.amountVnd.valueChanges, { initialValue: '' });
  readonly amountHint = computed(() => describeVndInput(this.amountValue()));

  /** Catalog jars; falls back to the jar being edited if the catalog could not be loaded. */
  readonly jarOptions = computed(() => {
    const jars = this.defaultJars().map((jar) => ({ jarType: jar.jarType, name: jar.name }));
    if (jars.length > 0) {
      return jars;
    }
    const editing = this.rows().find((row) => row.id === this.editingId());
    return editing ? [{ jarType: editing.jarType, name: editing.jarName }] : [];
  });

  constructor() {
    // A new month always starts from the loading state; reloads inside the same month may be quiet.
    toObservable(this.period)
      .pipe(
        switchMap((period) =>
          this.reloads.pipe(
            startWith(false),
            switchMap((quiet) => this.load(period, quiet))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((view) => this.view.set(view));
  }

  retry(): void {
    this.reloads.next(false);
  }

  startEdit(expense: CreatedExpense): void {
    if (this.busyId() !== null) {
      return;
    }
    this.rowError.set(null);
    this.notice.set('');
    this.form.reset({
      expenseDate: expense.expenseDate,
      jarType: expense.jarType,
      amountVnd: formatVndInput(expense.amountVnd),
      description: expense.description
    });
    this.editingId.set(expense.id);
    this.loadDefaultJars();
  }

  private loadDefaultJars(): void {
    if (this.defaultJarsRequested) {
      return;
    }
    this.defaultJarsRequested = true;
    this.api
      .getDefaultJars()
      .pipe(
        map((response) => (Array.isArray(response?.jars) ? response.jars : [])),
        catchError(() => {
          // Allow another attempt on the next edit; the form still offers the expense's own jar meanwhile.
          this.defaultJarsRequested = false;
          return of<DefaultJar[]>([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((jars) => this.defaultJars.set(jars));
  }

  cancelEdit(): void {
    if (this.busyId() !== null) {
      return;
    }
    this.editingId.set(null);
    this.rowError.set(null);
  }

  hasError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  save(expense: CreatedExpense): void {
    if (this.busyId() !== null) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.rowError.set({ id: expense.id, message: EXPENSE_FORM_INVALID_MESSAGE });
      return;
    }

    const raw = this.form.getRawValue();
    this.busyId.set(expense.id);
    this.rowError.set(null);
    this.api
      .updateExpense(expense.id, {
        expenseDate: raw.expenseDate,
        jarType: raw.jarType as JarType,
        amountVnd: normalizeVndInput(raw.amountVnd),
        description: raw.description.trim()
      })
      .pipe(
        finalize(() => this.busyId.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.editingId.set(null);
          this.notice.set(
            `Expense updated: ${response.expense.description}, ${formatVnd(response.expense.amountVnd)}.`
          );
          this.afterChange();
        },
        error: (error: AppError) =>
          this.rowError.set({
            id: expense.id,
            message: this.failureMessage(error, EXPENSE_SAVE_FAILED_MESSAGE)
          })
      });
  }

  deleteExpense(expense: CreatedExpense): void {
    if (this.busyId() !== null) {
      return;
    }
    const question = `Delete "${expense.description}" (${formatVnd(expense.amountVnd)})? This cannot be undone.`;
    if (!window.confirm(question)) {
      return;
    }

    this.busyId.set(expense.id);
    this.rowError.set(null);
    this.notice.set('');
    this.api
      .deleteExpense(expense.id)
      .pipe(
        finalize(() => this.busyId.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.afterDelete(expense),
        error: (error: AppError) => {
          // Already gone: the list is just stale.
          if (error.kind === 'not-found') {
            this.afterDelete(expense);
            return;
          }
          this.rowError.set({ id: expense.id, message: this.failureMessage(error, EXPENSE_DELETE_FAILED_MESSAGE) });
        }
      });
  }

  private afterDelete(expense: CreatedExpense): void {
    if (this.editingId() === expense.id) {
      this.editingId.set(null);
    }
    this.notice.set(`Expense deleted: ${expense.description}.`);
    this.afterChange();
  }

  private afterChange(): void {
    this.reloads.next(true);
    this.changed.emit();
  }

  private failureMessage(error: AppError, fallback: string): string {
    if (error.kind === 'network') {
      return error.message;
    }
    if (error.kind === 'validation' || error.kind === 'not-found') {
      return error.fieldErrors[0]?.message ?? error.message;
    }
    return fallback;
  }

  private load(period: Period, quiet: boolean): Observable<MonthExpensesView> {
    const request = this.api.getMonthlyExpenses(period.year, period.month).pipe(
      map((response): MonthExpensesView =>
        Array.isArray(response?.expenses)
          ? { status: 'ready', expenses: response.expenses }
          : { status: 'error', message: EXPENSES_LOAD_FAILED_MESSAGE }
      ),
      catchError((error: AppError) =>
        of<MonthExpensesView>({
          status: 'error',
          message: error.kind === 'network' ? error.message : EXPENSES_LOAD_FAILED_MESSAGE
        })
      )
    );
    return quiet ? request : request.pipe(startWith<MonthExpensesView>({ status: 'loading' }));
  }
}
