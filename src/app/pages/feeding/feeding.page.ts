import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { FeedService, Feed } from '../../services/feed';
import { ActivityService } from '../../services/activity.service';
@Component({
  selector: 'app-feeding',
  templateUrl: './feeding.page.html',
  styleUrls: ['./feeding.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class FeedingPage {
  isEditOpen = false;
  editFeedPickerValue = new Date().toISOString();
  editFeed: any = {
    id: '',
    quantity: 120,
    type: 'formula',
    time: ''
  };
  feeds: Feed[] = [];

  newFeed = {
    quantity: 120,
    type: 'formula' as 'formula' | 'breast',
    time: this.getCurrentTime()
  };

  editModeId: string | null = null;

  constructor(
    public feedService: FeedService,
    private activityService: ActivityService
  ) { }

  ngOnInit() {
    this.loadFeeds();
  }
  formatTime(event: any) {
    const value = event.detail.value;

    // convert ISO → readable time
    const date = new Date(value);

    this.newFeed.time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  formatEditTime(event: any) {
    const value = event.detail.value;
    const date = new Date(value);

    this.editFeed.time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  loadFeeds() {
    this.feeds = this.feedService.getFeeds();
  }

  // ➕ ADD / SAVE
  saveFeed() {

    if (this.editModeId) {
      const updated = this.feeds.map(f =>
        f.id === this.editModeId
          ? {
            ...f,
            quantity: this.newFeed.quantity,
            type: this.newFeed.type,
            time: this.newFeed.time
          }
          : f
      );

      this.feedService.saveAll(updated);
      this.editModeId = null;

    } else {
      const feed: Feed = {
        id: Date.now().toString(),
        time: this.newFeed.time,
        quantity: this.newFeed.quantity,
        type: this.newFeed.type
      };

      this.feedService.addFeed(feed);
      this.activityService.add({
        id: Date.now().toString(),
        type: 'feeding',
        title: 'Feeding',
        value: `${feed.quantity} ml ${feed.type}`,
        time: feed.time,
        createdAt: Date.now()
      });
    }

    this.resetForm();
    this.loadFeeds();
  }

  // ✏️ EDIT
  edit(feed: any) {
    this.editFeed = { ...feed };
    this.editFeedPickerValue = this.createDateFromTime(feed.time);
    this.isEditOpen = true;
  }
  createDateFromTime(time: string): string {
    const now = new Date();

    const parsed = new Date(`${now.toDateString()} ${time}`);

    if (isNaN(parsed.getTime())) {
      return now.toISOString();
    }

    return parsed.toISOString();
  }
  saveEdit() {
    const updated = this.feeds.map(f =>
      f.id === this.editFeed.id ? this.editFeed : f
    );

    this.feedService.saveAll(updated);
    this.loadFeeds();

    this.isEditOpen = false;
  }
  // 🗑 DELETE
  delete(id: string) {
    this.feedService.deleteFeed(id);
    this.loadFeeds();
  }

  resetForm() {
    this.newFeed = {
      quantity: 120,
      type: 'formula',
      time: this.getCurrentTime()
    };
  }
}