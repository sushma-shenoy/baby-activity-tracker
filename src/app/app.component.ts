import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import {
  ActivityReminderService
} from './services/notification';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor(
    private readonly activityReminderService: ActivityReminderService
  ) {
    void this.activityReminderService.initialize();
  }
}
