import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

import { addIcons } from 'ionicons';
import {
  addOutline,
  homeOutline,
  barChartOutline,
  bulbOutline,
  chevronForwardOutline,
  closeOutline,
  createOutline,
  ellipsisHorizontalOutline,
  pauseOutline,
  playOutline,
  settingsOutline,
  stopOutline,
  timeOutline,
  trashOutline
} from 'ionicons/icons';

addIcons({
  addOutline,
  homeOutline,
  barChartOutline,
  bulbOutline,
  chevronForwardOutline,
  closeOutline,
  createOutline,
  ellipsisHorizontalOutline,
  pauseOutline,
  playOutline,
  settingsOutline,
  stopOutline,
  timeOutline,
  trashOutline
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});
