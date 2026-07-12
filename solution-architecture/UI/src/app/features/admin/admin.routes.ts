import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'config/app',
    loadComponent: () =>
      import('./app-config/app-config.component').then(m => m.AppConfigComponent)
  },
  {
    path: 'config/ui',
    loadComponent: () =>
      import('./ui-config/ui-config.component').then(m => m.UiConfigComponent)
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./user-management/user-management.component').then(m => m.UserManagementComponent)
  },
  {
    path: 'tenants',
    loadComponent: () =>
      import('./tenant-management/tenant-management.component').then(m => m.TenantManagementComponent)
  },
  {
    path: 'errors',
    loadComponent: () =>
      import('./error-management/error-management.component').then(m => m.ErrorManagementComponent)
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./audit-log/audit-log.component').then(m => m.AuditLogComponent)
  },
];
