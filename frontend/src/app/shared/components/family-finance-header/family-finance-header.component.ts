import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { currentMonthSpendingPath } from '../../../features/monthly-planning/utils/period';

/**
 * App header: brand link (home) and the account menu. There is no auth in scope, so the menu holds shortcuts only.
 * Disclosure pattern (button + `aria-expanded` + list of links): it closes on Escape, an outside click and navigation.
 */
@Component({
  selector: 'app-family-finance-header',
  imports: [RouterLink],
  templateUrl: './family-finance-header.component.html',
  styleUrl: './family-finance-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()'
  }
})
export class FamilyFinanceHeaderComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('accountTrigger');

  readonly familyName = 'Family Name';
  readonly initials = 'FN';
  readonly menuOpen = signal(false);

  /** Evaluated per render, so "This month" follows the calendar without a reload. */
  homePath(): string {
    return currentMonthSpendingPath();
  }

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.menuOpen.set(false);
    }
  }

  onEscape(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.trigger()?.nativeElement.focus();
    }
  }
}
