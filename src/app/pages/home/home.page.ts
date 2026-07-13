import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Activity } from '../../shared/models/activity-model';
import { ActivityService } from '../../services/activity.service';
import { ActivityCardComponent } from 'src/app/components/activity-card/activity-card.component';
@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterLink,   ActivityCardComponent
]
})
export class HomePage {
  recentActivities: Activity[] = [];
  constructor(
  private router: Router,
  private activityService: ActivityService
) {}
ngOnInit() {
  this.activityService.activities$.subscribe((data: any) => {
    this.recentActivities = data.slice(0, 5);
  });
}
  stats = {
    feeds: 4,
    sleep: 10,
    diapers: 6
  };
donuts = [
  {
    label: 'Feeds',
    value: this.stats.feeds,
    goal: 8,
    percent: 65,
    icon: '🍼',
    class: 'feed-donut'
  },
  {
    label: 'Sleep',
    value: this.stats.sleep,
    goal: 12,
    percent: 70,
    icon: '😴',
    class: 'sleep-donut'
  },
  {
    label: 'Diapers',
    value: this.stats.diapers,
    goal: 7,
    percent: 55,
    icon: '🧷',
    class: 'diaper-donut'
  }
];
  baby = {
    name: 'Aradhya',
    age: '6 months',
    mood: 'Happy 😊'
  };


   getIcon(type: string): string {
    switch (type) {
      case 'feeding':
        return '🍼';
      case 'sleep':
        return '😴';
      case 'diaper':
        return '🧷';
      default:
        return '📝';
    }
  }
}
