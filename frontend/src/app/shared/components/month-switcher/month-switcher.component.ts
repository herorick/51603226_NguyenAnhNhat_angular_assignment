import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Period, formatPeriodLabel, shiftPeriod } from '../../../features/monthly-planning/utils/period';

interface MonthLink {
  label: string;
  commands: (string | number)[];
}

/**
 * Previous / next month links for the month pages (`/monthly-plans/:year/:month[/spending]`), so the user can walk
 * through months without going back to the list. A link is hidden when it would leave the API's year range.
 */
@Component({
  selector: 'app-month-switcher',
  imports: [RouterLink],
  template: `
    <nav class="month-switcher" aria-label="Change month">
      @if (previous(); as prev) {
        <a class="switch-link" [routerLink]="prev.commands" [attr.aria-label]="'Previous month, ' + prev.label">
          <span aria-hidden="true">‹</span> {{ prev.label }}
        </a>
      }
      <span class="switch-current" aria-current="page">{{ currentLabel() }}</span>
      @if (next(); as nxt) {
        <a class="switch-link" [routerLink]="nxt.commands" [attr.aria-label]="'Next month, ' + nxt.label">
          {{ nxt.label }} <span aria-hidden="true">›</span>
        </a>
      }
    </nav>
  `,
  styles: `
    .month-switcher {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
      font-size: var(--f1-small);
    }
    .switch-link {
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      color: var(--f1-slate);
      text-decoration: none;
    }
    .switch-link:hover {
      background: var(--surface-hover);
    }
    .switch-link:focus-visible {
      outline: 0.1875rem solid var(--nt-focus);
      outline-offset: 0.125rem;
    }
    .switch-current {
      color: var(--f1-navy);
      font-weight: 700;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthSwitcherComponent {
  readonly period = input.required<Period>();
  /** Trailing route segment, e.g. `spending`; empty for the plan page. */
  readonly section = input<string>('');

  readonly currentLabel = computed(() => formatPeriodLabel(this.period()));
  readonly previous = computed(() => this.linkTo(shiftPeriod(this.period(), -1)));
  readonly next = computed(() => this.linkTo(shiftPeriod(this.period(), 1)));

  private linkTo(period: Period | null): MonthLink | null {
    if (!period) {
      return null;
    }
    const section = this.section();
    return {
      label: formatPeriodLabel(period),
      commands: ['/monthly-plans', period.year, period.month, ...(section ? [section] : [])]
    };
  }
}
