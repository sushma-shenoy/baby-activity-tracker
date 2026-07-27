import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
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
        { provide: AuthService, useValue: authService },
        {
          provide: Router,
          useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl'])
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
