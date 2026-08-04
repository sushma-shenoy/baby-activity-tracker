import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'home',
    canActivate: [authGuard],
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
    canActivate: [authGuard],
    loadComponent: () => import('./pages/feeding/feeding.page').then( m => m.FeedingPage)
  },
  {
    path: 'solids',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/solids/solids.page').then(m => m.SolidsPage)
  },
  {
    path: 'sleep',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/sleep/sleep.page').then( m => m.SleepPage)
  },
  {
    path: 'diaper',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/diaper/diaper.page').then( m => m.DiaperPage)
  },
  {
    path: 'growth',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/growth/growth.page').then( m => m.GrowthPage)
  },
  {
    path: 'medicine',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/medicine/medicine.page').then( m => m.MedicinePage)
  },
  {
    path: 'vaccination',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/vaccination/vaccination.page').then( m => m.VaccinationPage)
  },
  {
    path: 'temperature',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/temperature/temperature.page').then( m => m.TemperaturePage)
  },
  {
    path: 'milestones',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/milestones/milestones.page').then( m => m.MilestonesPage)
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings/settings.page').then( m => m.SettingsPage)
  },
  {
    path: 'reminders',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/reminders/reminders.page').then(m => m.RemindersPage)
  },
  {
    path: 'settings/goals',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/daily-goals/daily-goals.page').then(m => m.DailyGoalsPage)
  },
  {
    path: 'insights',
    canActivate: [authGuard],
      loadComponent: () => import('./pages/insights/insights.page').then( m => m.InsightsPage)
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/calendar/calendar.page').then(m => m.CalendarPage)
  },
  {
    path: 'journal',
    canActivate: [authGuard],
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
