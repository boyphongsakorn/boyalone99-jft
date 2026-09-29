import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

function isExpiredToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

export const adminAuthGuard: CanActivateFn = () => {
  if (typeof window === 'undefined') return true;
  const router = inject(Router);
  const token = localStorage.getItem('admin_token');
  if (!token) return router.createUrlTree(['/auth']);
  // Proactively drop expired/malformed JWTs instead of loading the dashboard
  // just to fail every API call.
  if (isExpiredToken(token)) {
    localStorage.removeItem('admin_token');
    return router.createUrlTree(['/auth']);
  }
  return true;
};
