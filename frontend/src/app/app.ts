import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { FamilyFinanceHeaderComponent } from './shared/components/family-finance-header/family-finance-header.component';
import { FamilyFinanceSidebarComponent } from './shared/components/family-finance-sidebar/family-finance-sidebar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FamilyFinanceHeaderComponent, FamilyFinanceSidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {}
