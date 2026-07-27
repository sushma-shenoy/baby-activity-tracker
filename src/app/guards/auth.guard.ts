import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitUntilReady();

  return authService.isLoggedIn
    ? true
    : router.createUrlTree(
        ['/login'],
        { queryParams: { returnUrl: state.url } }
      );
};

export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitUntilReady();

  return authService.isLoggedIn
    ? router.createUrlTree(['/home'])
    : true;
};
