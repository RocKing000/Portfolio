import { Routes } from '@angular/router';
import { cameraPermissionGuard } from './core/guards/camera-permission.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'kyc',
    pathMatch: 'full'
  },
  {
    path: 'kyc',
    loadComponent: () =>
      import('./features/kyc-flow/kyc-flow.component').then(m => m.KycFlowComponent),
    canActivate: [cameraPermissionGuard]
  },
  {
    path: 'permission-denied',
    loadComponent: () =>
      import('./features/permission-denied/permission-denied.component').then(m => m.PermissionDeniedComponent)
  },
  {
    path: '**',
    redirectTo: 'kyc'
  }
];
