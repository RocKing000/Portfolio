import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';

export const RoleGuard: CanActivateFn = async (route) => {
  const keycloak = inject(KeycloakService);
  const router   = inject(Router);

  const requiredRoles: string[] = route.data?.['roles'] ?? [];
  if (!requiredRoles.length) return true;

  const userRoles = keycloak.getUserRoles();
  const hasRole   = requiredRoles.some(role => userRoles.includes(role));

  if (!hasRole) {
    await router.navigate(['/forbidden']);
    return false;
  }
  return true;
};
