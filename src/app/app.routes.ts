import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.page').then( m => m.DashboardPage)
  },
  {
    path: 'feeding',
    loadComponent: () => import('./pages/feeding/feeding.page').then( m => m.FeedingPage)
  },
  {
    path: 'sleep',
    loadComponent: () => import('./pages/sleep/sleep.page').then( m => m.SleepPage)
  },
  {
    path: 'diaper',
    loadComponent: () => import('./pages/diaper/diaper.page').then( m => m.DiaperPage)
  },
  {
    path: 'growth',
    loadComponent: () => import('./pages/growth/growth.page').then( m => m.GrowthPage)
  },
  {
    path: 'medicine',
    loadComponent: () => import('./pages/medicine/medicine.page').then( m => m.MedicinePage)
  },
  {
    path: 'vaccination',
    loadComponent: () => import('./pages/vaccination/vaccination.page').then( m => m.VaccinationPage)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.page').then( m => m.SettingsPage)
  },
  {
    path: 'insights',
    loadComponent: () => import('./pages/insights/insights.page').then( m => m.InsightsPage)
  },
];
