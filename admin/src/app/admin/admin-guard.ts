import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminAuthGuard: CanActivateFn = () => {
  if (typeof window === 'undefined') return true;
  const token = localStorage.getItem('admin_token');
  if (token) return true;
  return inject(Router).createUrlTree(['/auth']);
};
