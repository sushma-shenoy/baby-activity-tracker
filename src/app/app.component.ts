import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  closeOutline,
  createOutline,
  ellipsisHorizontalOutline,
  pauseOutline,
  playOutline,
  stopOutline,
  timeOutline,
  trashOutline,
  addOutline,
  chevronForwardOutline
} from 'ionicons/icons';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    addIcons({
      closeOutline,
      addOutline,
      createOutline,
      chevronForwardOutline,
      ellipsisHorizontalOutline,
      trashOutline,
      pauseOutline,
      playOutline,
      stopOutline,
      timeOutline,

    });
  }
}
