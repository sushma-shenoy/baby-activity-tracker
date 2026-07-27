import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['login', 'resetPassword']
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        FormBuilder,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not submit an invalid form', async () => {
    await component.login();
    expect(authService.login).not.toHaveBeenCalled();
    expect(component.errorMessage)
      .toBe('Please enter a valid email and password.');
  });

  it('logs in and routes home', async () => {
    authService.login.and.resolveTo({ success: true });
    router.navigateByUrl.and.resolveTo(true);
    component.loginForm.setValue({
      email: 'parent@example.com',
      password: 'secret'
    });

    await component.login();

    expect(authService.login)
      .toHaveBeenCalledWith('parent@example.com', 'secret');
    expect(router.navigateByUrl)
      .toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('sends a password reset email', async () => {
    authService.resetPassword.and.resolveTo({ success: true });
    component.loginForm.patchValue({ email: 'parent@example.com' });

    await component.resetPassword();

    expect(authService.resetPassword)
      .toHaveBeenCalledWith('parent@example.com');
    expect(component.successMessage)
      .toBe('Password reset email sent. Check your inbox.');
  });
});
