import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  if (typeof window === 'undefined') return true;
  if (localStorage.getItem('user_profile')) return true;
  return inject(Router).createUrlTree(['/login']);
};
