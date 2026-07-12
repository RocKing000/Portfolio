import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { DataService } from './services/data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title         = 'LOS Dashboard';
  currentRoute  = '/dashboard';
  sidebarOpen   = false;

  navItems = [
    { route: '/dashboard',    label: 'Dashboard',       icon: '📊' },
    { route: '/predictions',  label: 'Risk Prediction',  icon: '🤖' },
    { route: '/analytics',    label: 'Analytics',        icon: '📈' },
    { route: '/flags',        label: 'Flag Management',  icon: '🏷️' },
    { route: '/alert-pools',  label: 'Alert Pools',      icon: '🎯' },
    { route: '/hierarchy',    label: 'Hierarchy View',   icon: '🌳' },
    { route: '/reports',      label: 'Reports',          icon: '📄' },
    { route: '/settings',     label: 'Settings',         icon: '⚙️' },
  ];

  constructor(private router: Router, public data: DataService) {}

  ngOnInit() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.currentRoute = e.urlAfterRedirects;
      this.sidebarOpen  = false;
    });
    this.data.loadDashboard();
  }

  isActive(route: string): boolean { return this.currentRoute.startsWith(route); }
}
