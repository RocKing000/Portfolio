import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

export const APP_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'projects',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./features/projects/projects.routes').then(m => m.PROJECT_ROUTES),
  },
  {
    path: 'sessions/:sessionId',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./features/session/session.routes').then(m => m.SESSION_ROUTES),
  },
  {
    path: 'review',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['SeniorDeveloper', 'TechLead', 'SolutionArchitect', 'UIUXLead', 'MLEngineer', 'IntegrationSpecialist', 'SecurityReviewer'] },
    loadComponent: () =>
      import('./features/review/review-queue.component').then(m => m.ReviewQueueComponent),
  },
  {
    path: 'audit',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['TechLead', 'SolutionArchitect', 'ProjectLead'] },
    loadComponent: () =>
      import('./features/audit/audit.component').then(m => m.AuditComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
