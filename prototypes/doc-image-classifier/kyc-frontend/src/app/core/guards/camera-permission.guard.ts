import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CameraService } from '../services/camera.service';

export const cameraPermissionGuard: CanActivateFn = async () => {
  const camera = inject(CameraService);
  const router = inject(Router);

  const status = camera.permissionStatus$.value;
  if (status === 'granted') return true;

  const granted = await camera.requestPermission();
  if (granted) return true;

  return router.createUrlTree(['/permission-denied']);
};
