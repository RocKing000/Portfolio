import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import {
  KeycloakAngularModule,
  KeycloakBearerInterceptor,
  KeycloakService,
} from 'keycloak-angular';

import { APP_ROUTES } from './app.routes';
import { reducers, metaReducers } from './store/reducers';
import { SessionEffects } from './store/effects/session.effects';
import { ReviewEffects } from './store/effects/review.effects';
import { environment } from '../environments/environment';

function initKeycloak(keycloak: KeycloakService): () => Promise<boolean> {
  return () =>
    keycloak.init({
      config: {
        url:   environment.keycloakUrl,
        realm: environment.keycloakRealm,
        clientId: environment.keycloakClientId,
      },
      initOptions: {
        onLoad:        'check-sso',
        silentCheckSsoRedirectUri: `${window.location.origin}/assets/silent-check-sso.html`,
        checkLoginIframe: false,
      },
      loadUserProfileAtStartUp: true,
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([
        // Keycloak bearer token injected via functional interceptor wrapper
        (req, next) => {
          // Bearer token is attached by KeycloakBearerInterceptor registered below
          return next(req);
        },
      ])
    ),
    provideAnimations(),
    provideStore(reducers, { metaReducers }),
    provideEffects([SessionEffects, ReviewEffects]),
    provideRouterStore(),
    importProvidersFrom(KeycloakAngularModule),
    KeycloakService,
    {
      provide: 'APP_INITIALIZER',
      useFactory: initKeycloak,
      multi: true,
      deps: [KeycloakService],
    },
    KeycloakBearerInterceptor,
  ],
};
