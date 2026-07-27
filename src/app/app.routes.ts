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
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.page').then( m => m.DashboardPage)
  },
  {
    path: 'feeding',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/feeding/feeding.page').then( m => m.FeedingPage)
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
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings/settings.page').then( m => m.SettingsPage)
  },
  {
    path: 'insights',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/insights/insights.page').then( m => m.InsightsPage)
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
];
