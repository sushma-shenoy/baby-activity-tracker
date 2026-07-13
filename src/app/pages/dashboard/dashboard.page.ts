import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { ActivityService } from '../../services/activity.service';
import { Activity } from 'src/app/shared/models/activity-model';
import { ActivityCardComponent } from '../../components/activity-card/activity-card.component';
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    ActivityCardComponent
  ]
})
export class DashboardPage implements OnInit {

  stats = {
    feeding: 0,
    sleep: 0,
    diaper: 0,
    lastFeedAgo: 'No feed yet'
  };

  activities: Activity[] = [];

  constructor(
    private router: Router,
    private activityService: ActivityService
  ) {}

  ngOnInit() {
    this.activityService.activities$.subscribe(data => {
      this.activities = data.slice(0, 5);

      this.stats.feeding = data.filter(x => x.type === 'feeding').length;
      this.stats.sleep = data.filter(x => x.type === 'sleep').length;
      this.stats.diaper = data.filter(x => x.type === 'diaper').length;

      const lastFeed = data.find(x => x.type === 'feeding');
      this.stats.lastFeedAgo = lastFeed ? lastFeed.time : 'No feed yet';
    });
  }

  goTo(page: string) {
    this.router.navigate([`/${page}`]);
  }

  add(type: string) {
    this.router.navigate([`/${type}`]);
  }

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