import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Primary navigation. The active item comes from `routerLinkActive`, so pages never pass it in. */
@Component({
  selector: 'app-family-finance-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './family-finance-sidebar.component.html',
  styleUrl: './family-finance-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyFinanceSidebarComponent {}
