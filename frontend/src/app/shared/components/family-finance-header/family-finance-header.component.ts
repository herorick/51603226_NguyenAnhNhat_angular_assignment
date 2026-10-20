import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Static app header: brand link and the placeholder account button (no auth in scope). */
@Component({
  selector: 'app-family-finance-header',
  imports: [RouterLink],
  templateUrl: './family-finance-header.component.html',
  styleUrl: './family-finance-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyFinanceHeaderComponent {}
