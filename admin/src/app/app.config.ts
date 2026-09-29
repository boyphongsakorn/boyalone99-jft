import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors, HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const adminAuthInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  if (typeof window === 'undefined') return next(req);
  const router = inject(Router);
  const token = localStorage.getItem('admin_token');
  const authReq = token ? req.clone({ setHeaders: { 'x-admin-token': token } }) : req;
  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Backend rejects bad/expired admin JWT with 401/403. Auto-logout
      // so a stale token never leaves the user stuck on a broken dashboard.
      const isAuthEndpoint = authReq.url.includes('/admin/auth/');
      if (token && !isAuthEndpoint && (err?.status === 401 || err?.status === 403)) {
        localStorage.removeItem('admin_token');
        router.navigateByUrl('/auth');
      }
      return throwError(() => err);
    })
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), 
    provideClientHydration(),
    provideHttpClient(withInterceptors([adminAuthInterceptor]))
  ]
};
