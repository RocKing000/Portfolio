import { Component, OnInit, OnDestroy, inject, computed, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SignalStore } from '../../../core/services/signal.store';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly authSvc     = inject(AuthService);
  readonly signalStore = inject(SignalStore);
  readonly langSvc     = inject(LanguageService);
  private readonly router = inject(Router);
  readonly menuToggle = output<void>();

  private readonly currentRouteKey = signal('route_knowledge_base');
  readonly currentRouteName = computed(() => this.langSvc.t(this.currentRouteKey()));

  readonly criticalCount = computed(() => this.signalStore.criticalSignals().length);

  readonly userInitials = computed(() => {
    const user = this.authSvc.currentUserDto;
    if (!user) return '?';
    const name = user.fullName || user.username || '?';
    return name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  private readonly routeKeys: { [key: string]: string } = {
    '/search':    'route_knowledge_base',
    '/signals':   'route_signals',
    '/analytics': 'route_analytics',
    '/dashboard': 'route_dashboard',
    '/hierarchy': 'route_faq',
    '/admin':     'route_admin',
  };

  private refreshTimer?: ReturnType<typeof setInterval>;
  private routeSub?: Subscription;

  ngOnInit(): void {
    this.signalStore.loadSignals();
    this.refreshTimer = setInterval(() => this.signalStore.loadSignals(), 30_000);

    this.updateCurrentRoute(this.router.url);
    this.routeSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => (event as NavigationEnd).url)
    ).subscribe(url => this.updateCurrentRoute(url));
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    this.routeSub?.unsubscribe();
  }

  private updateCurrentRoute(url: string): void {
    const path = '/' + url.split('?')[0].split(';')[0].split('/').filter(Boolean)[0];
    this.currentRouteKey.set(this.routeKeys[path] ?? 'route_knowledge_base');
  }

  logout(): void { this.authSvc.logout(); }
}
