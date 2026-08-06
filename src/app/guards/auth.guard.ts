import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { trackerStorage } from '../firebase/tracker-storage';

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

export const caregiverAccessGuard: CanActivateFn = () => {
  const router = inject(Router);
  return trackerStorage.isCaregiverOnlyAccount &&
    !trackerStorage.isUsingSharedFamily
    ? router.createUrlTree(['/caregiver-no-access'])
    : true;
};
