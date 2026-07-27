import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

describe('authentication guards', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['waitUntilReady'],
      { isLoggedIn: false }
    );
    authService.waitUntilReady.and.resolveTo();

    router = jasmine.createSpyObj<Router>(
      'Router',
      ['createUrlTree']
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('redirects signed-out users to login with a return URL', async () => {
    const loginTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(loginTree);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/feeding' } as RouterStateSnapshot
      )
    );

    expect(result).toBe(loginTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(
      ['/login'],
      { queryParams: { returnUrl: '/feeding' } }
    );
  });

  it('allows signed-out users to open guest routes', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      guestGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeTrue();
  });
});
