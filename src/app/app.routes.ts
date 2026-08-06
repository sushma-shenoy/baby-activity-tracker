import { Routes } from '@angular/router';
import {
  authGuard,
  caregiverAccessGuard,
  guestGuard
} from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'caregiver-no-access',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/caregiver-no-access/caregiver-no-access.page').then(m => m.CaregiverNoAccessPage)
  },
  {
    path: 'create-family',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/create-family/create-family.page').then(m => m.CreateFamilyPage)
  },
  {
    path: 'home',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    redirectTo: 'insights',
    pathMatch: 'full'
  },
  {
    path: 'feeding',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/feeding/feeding.page').then( m => m.FeedingPage)
  },
  {
    path: 'solids',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/solids/solids.page').then(m => m.SolidsPage)
  },
  {
    path: 'sleep',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/sleep/sleep.page').then( m => m.SleepPage)
  },
  {
    path: 'diaper',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/diaper/diaper.page').then( m => m.DiaperPage)
  },
  {
    path: 'growth',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/growth/growth.page').then( m => m.GrowthPage)
  },
  {
    path: 'medicine',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/medicine/medicine.page').then( m => m.MedicinePage)
  },
  {
    path: 'vaccination',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/vaccination/vaccination.page').then( m => m.VaccinationPage)
  },
  {
    path: 'temperature',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/temperature/temperature.page').then( m => m.TemperaturePage)
  },
  {
    path: 'milestones',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/milestones/milestones.page').then( m => m.MilestonesPage)
  },
  {
    path: 'settings',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/settings/settings.page').then( m => m.SettingsPage)
  },
  {
    path: 'reminders',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/reminders/reminders.page').then(m => m.RemindersPage)
  },
  {
    path: 'settings/goals',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/daily-goals/daily-goals.page').then(m => m.DailyGoalsPage)
  },
  {
    path: 'settings/profile',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/profile-edit/profile-edit.page').then(m => m.ProfileEditPage)
  },
  {
    path: 'settings/data',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/data-settings/data-settings.page').then(m => m.DataSettingsPage)
  },
  {
    path: 'settings/family',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/family-settings/family-settings.page').then(m => m.FamilySettingsPage)
  },
  {
    path: 'settings/change-requests',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/change-requests/change-requests.page').then(m => m.ChangeRequestsPage)
  },
  {
    path: 'my-change-requests',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/my-change-requests/my-change-requests.page').then(m => m.MyChangeRequestsPage)
  },
  {
    path: 'insights',
    canActivate: [authGuard, caregiverAccessGuard],
      loadComponent: () => import('./pages/insights/insights.page').then( m => m.InsightsPage)
  },
  {
    path: 'calendar',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/calendar/calendar.page').then(m => m.CalendarPage)
  },
  {
    path: 'journal',
    canActivate: [authGuard, caregiverAccessGuard],
    loadComponent: () => import('./pages/journal/journal.page').then(m => m.JournalPage)
  },
  {
    path: 'caregiver-invite',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/caregiver-invite/caregiver-invite.page').then(m => m.CaregiverInvitePage)
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/signup/signup.page').then( m => m.SignupPage)
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
