import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const guestOnlyGuard: CanActivateFn = () => {
  if (typeof window === 'undefined') return true;
  if (localStorage.getItem('user_profile')) {
    return inject(Router).createUrlTree(['/']);
  }
  return true;
};
