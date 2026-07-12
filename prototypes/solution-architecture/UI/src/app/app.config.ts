import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { encryptionInterceptor } from './core/interceptors/encryption.interceptor';
import { languageInterceptor } from './core/interceptors/language.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    // Request order: language (set Accept-Language) → jwt (add Bearer) → encryption (wrap/unwrap) → httpError
    provideHttpClient(withInterceptors([languageInterceptor, jwtInterceptor, encryptionInterceptor, httpErrorInterceptor])),
    provideAnimations()
  ]
};
