import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from 'firebase/auth';
import { AuthService } from '../../services/auth.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['logout'],
      {
        currentUser: {
          displayName: 'Alex',
          email: 'alex@example.com'
        } as User
      }
    );

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rejects a future date of birth', () => {
    component.preferencesForm.controls.birthDate.setValue('2999-01-01');
    component.preferencesForm.controls.birthDate.markAsTouched();

    expect(component.preferencesForm.controls.birthDate.hasError('futureDate'))
      .toBeTrue();
    expect(component.birthDateError)
      .toBe('Date of birth cannot be in the future.');
  });

  it('rejects an impossible calendar date', () => {
    component.preferencesForm.controls.birthDate.setValue('2025-02-30');
    component.preferencesForm.controls.birthDate.markAsTouched();

    expect(component.preferencesForm.controls.birthDate.hasError('invalidDate'))
      .toBeTrue();
  });

  it('requires a date of birth', () => {
    component.preferencesForm.controls.birthDate.setValue('');
    component.savePreferences();

    expect(component.preferencesForm.controls.birthDate.hasError('required'))
      .toBeTrue();
  });

  it('shows a future-date error for a new baby profile', () => {
    component.newProfileForm.controls.birthDate.setValue('2999-01-01');
    component.newProfileForm.controls.birthDate.markAsTouched();

    expect(component.newProfileBirthDateError)
      .toBe('Date of birth cannot be in the future.');
  });

  it('shows an invalid-calendar error for a new baby profile', () => {
    component.newProfileForm.controls.birthDate.setValue('2025-02-30');
    component.newProfileForm.controls.birthDate.markAsTouched();

    expect(component.newProfileBirthDateError)
      .toBe('Enter a valid calendar date.');
  });
});
