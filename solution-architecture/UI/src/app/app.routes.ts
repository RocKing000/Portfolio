import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'search', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/error-search/error-search.component').then(m => m.ErrorSearchComponent)
  },
  {
    path: 'hierarchy',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/hierarchy-browser/hierarchy-browser.component').then(m => m.HierarchyBrowserComponent)
  },
  {
    path: 'analytics',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/analytics-dashboard/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then(m => m.adminRoutes)
  },
  // Signal Management
  {
    path: 'signals',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/signals/signal-list/signal-list.component').then(m => m.SignalListComponent)
  },
  {
    path: 'signals/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/signals/signal-details/signal-details.component').then(m => m.SignalDetailsComponent)
  },
  // Dashboard Builder
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard-builder/dashboard-canvas/dashboard-canvas.component').then(m => m.DashboardCanvasComponent)
  },
  {
    path: 'dashboard/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard-builder/dashboard-canvas/dashboard-canvas.component').then(m => m.DashboardCanvasComponent)
  },
  { path: '**', redirectTo: 'search' }
];
