import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '',            redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard',   loadComponent: () => import('./modules/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'predictions', loadComponent: () => import('./modules/predictions/predictions.component').then(m => m.PredictionsComponent) },
  { path: 'analytics',   loadComponent: () => import('./modules/analytics/analytics.component').then(m => m.AnalyticsComponent) },
  { path: 'flags',       loadComponent: () => import('./modules/flags/flags.component').then(m => m.FlagsComponent) },
  { path: 'alert-pools', loadComponent: () => import('./modules/alert-pools/alert-pools.component').then(m => m.AlertPoolsComponent) },
  { path: 'hierarchy',   loadComponent: () => import('./modules/hierarchy/hierarchy.component').then(m => m.HierarchyComponent) },
  { path: 'reports',     loadComponent: () => import('./modules/reports/reports.component').then(m => m.ReportsComponent) },
  { path: 'settings',    loadComponent: () => import('./modules/settings/settings.component').then(m => m.SettingsComponent) },
  { path: '**',          redirectTo: 'dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
