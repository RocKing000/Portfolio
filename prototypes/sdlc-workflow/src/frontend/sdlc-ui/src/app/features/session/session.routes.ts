import { Routes } from '@angular/router';

export const SESSION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./session-detail.component').then(m => m.SessionDetailComponent),
  },
];
