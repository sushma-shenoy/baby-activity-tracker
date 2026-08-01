import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import {
  initializeTrackerStorage
} from './app/firebase/tracker-storage';

import { addIcons } from 'ionicons';
import {
  addOutline,
  homeOutline,
  barChartOutline,
  bulbOutline,
  cameraOutline,
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
  cameraOutline,
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

async function startApplication(): Promise<void> {
  try {
    await initializeTrackerStorage();
  } catch (error) {
    console.error(
      'Unable to initialize Firestore tracker storage. Starting with an empty offline state.',
      error
    );
  }

  await bootstrapApplication(AppComponent, {
    providers: [
      { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
      provideIonicAngular(),
      provideRouter(routes, withPreloading(PreloadAllModules)),
    ],
  });
}

void startApplication();
