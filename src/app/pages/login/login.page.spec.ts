import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['login', 'resetPassword']
    );
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        FormBuilder,
        { provide: AuthService, useValue: authService }
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
    component.loginForm.setValue({
      email: 'parent@example.com',
      password: 'secret'
    });

    const reloadSpy = spyOn(component, 'reloadApp');
    await component.login();

    expect(authService.login)
      .toHaveBeenCalledWith('parent@example.com', 'secret');
    expect(reloadSpy).toHaveBeenCalledWith('/home');
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
