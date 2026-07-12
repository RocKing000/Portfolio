import { Routes } from '@angular/router';

export const PROJECT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./project-list.component').then(m => m.ProjectListComponent),
  },
  {
    path: ':projectId',
    loadComponent: () =>
      import('./project-detail.component').then(m => m.ProjectDetailComponent),
  },
];
