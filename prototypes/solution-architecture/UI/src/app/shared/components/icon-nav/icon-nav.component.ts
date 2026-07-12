import { Component, inject, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LanguageService } from '../../../core/services/language.service';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  future?: boolean;
}

@Component({
  selector: 'app-icon-nav',
  standalone: true,
  imports: [RouterModule, MatIconModule, MatTooltipModule],
  templateUrl: './icon-nav.component.html',
  styleUrl: './icon-nav.component.scss'
})
export class IconNavComponent {
  readonly langSvc        = inject(LanguageService);
  readonly collapsed      = input(false);
  readonly collapseToggle = output<void>();

  readonly navItems: NavItem[] = [
    { labelKey: 'nav_knowledge_base', icon: 'search',        route: '/search'    },
    { labelKey: 'nav_faq',            icon: 'account_tree',  route: '/hierarchy' },
    { labelKey: 'nav_analytics',      icon: 'insert_chart',  route: '/analytics' },
    { labelKey: 'nav_signals',        icon: 'error_outline', route: '/signals',   future: true },
    { labelKey: 'nav_dashboard',      icon: 'dashboard',     route: '/dashboard', future: true }
  ];

  toggle(): void {
    this.collapseToggle.emit();
  }
}
