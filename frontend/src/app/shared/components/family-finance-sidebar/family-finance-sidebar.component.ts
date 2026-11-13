import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { currentMonthSpendingPath } from '../../../features/monthly-planning/utils/period';

export type NavIcon = 'home' | 'months' | 'plan' | 'expense' | 'compare';

export interface NavItem {
  label: string;
  link: string;
  icon: NavIcon;
  active: boolean;
}

/** Path part of a router URL (`/a/b?x=1#y` -> `/a/b`). */
const pathOf = (url: string): string => url.split(/[?#]/)[0];

/**
 * Primary navigation. The active item is derived from the URL the router settled on (after redirects), so
 * "Home" is highlighted on the current month's spending page and "All months" on every other month page.
 */
@Component({
  selector: 'app-family-finance-sidebar',
  imports: [RouterLink],
  templateUrl: './family-finance-sidebar.component.html',
  styleUrl: './family-finance-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyFinanceSidebarComponent {
  private readonly router = inject(Router);

  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => pathOf(event.urlAfterRedirects))
    ),
    { initialValue: pathOf(this.router.url) }
  );

  readonly items = computed<NavItem[]>(() => {
    const path = this.path();
    const homePath = currentMonthSpendingPath();
    const isHome = path === homePath || path === '/dashboard';
    return [
      { label: 'Home', link: homePath, icon: 'home', active: isHome },
      {
        label: 'All months',
        link: '/monthly-plans',
        icon: 'months',
        active: !isHome && (path === '/monthly-plans' || path.startsWith('/monthly-plans/'))
      },
      { label: 'Create plan', link: '/monthly-planning', icon: 'plan', active: path === '/monthly-planning' },
      { label: 'Add Expense', link: '/expenses/new', icon: 'expense', active: path === '/expenses/new' },
      { label: 'Compare', link: '/compare', icon: 'compare', active: path === '/compare' }
    ];
  });
}
