import { Injectable } from '@angular/core';
import { trackerStorage } from '../firebase/tracker-storage';
import { firebaseAuth } from '../firebase/firebase.config';
import {
  isValidTime24
} from '../shared/date-time.utils';

export interface Feed {
  id: string;
  time: string;
  createdAt?: number;
  quantity: number;
  type: 'expressed' | 'formula';
  createdByUid?: string;
  createdByName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FeedService {

  private key = 'feeds';

  constructor() {}

  // 📥 GET ALL FEEDS
  getFeeds(): Feed[] {
    try {
      const value = JSON.parse(trackerStorage.getItem(this.key) || '[]');
      if (!Array.isArray(value)) return [];

      return value
        .map(feed => ({
          ...feed,
          type: feed?.type === 'breast' ? 'expressed' : feed?.type
        }))
        .filter(feed => this.isValidFeed(feed));
    } catch {
      return [];
    }
  }

  // ➕ ADD FEED
  addFeed(feed: Feed): boolean {
    if (!this.isValidFeed(feed)) return false;
    const feeds = this.getFeeds();
    feeds.unshift(this.withCreator(this.normalize(feed)));
    trackerStorage.setItem(this.key, JSON.stringify(feeds));
    return true;
  }

  // ❌ DELETE FEED
  deleteFeed(id: string) {
    const feeds = this.getFeeds().filter(f => f.id !== id);
    trackerStorage.setItem(this.key, JSON.stringify(feeds));
  }

  // 📊 COUNT (useful for dashboard later)
  count(): number {
    return this.getFeeds().length;
  }
  saveAll(feeds: Feed[]): void {
    trackerStorage.setItem(
      this.key,
      JSON.stringify(
        feeds
          .filter(feed => this.isValidFeed(feed))
          .map(feed => this.normalize(feed))
      )
    );
  }

  private isValidFeed(feed: unknown): feed is Feed {
    if (!feed || typeof feed !== 'object') return false;
    const candidate = feed as Partial<Feed>;
    const quantity = Number(candidate.quantity);
    return (
      typeof candidate.id === 'string' &&
      candidate.id.length > 0 &&
      (candidate.type === 'formula' || candidate.type === 'expressed') &&
      Number.isInteger(quantity) &&
      quantity >= 5 &&
      quantity <= 1000 &&
      typeof candidate.time === 'string' &&
      isValidTime24(candidate.time) &&
      (candidate.createdAt === undefined || Number.isFinite(candidate.createdAt))
    );
  }

  private normalize(feed: Feed): Feed {
    return {
      ...feed,
      quantity: Number(feed.quantity)
    };
  }

  private withCreator(feed: Feed): Feed {
    const user = firebaseAuth.currentUser;
    return !user || feed.createdByUid ? feed : {
      ...feed,
      createdByUid: user.uid,
      createdByName: user.displayName || user.email || 'Caregiver'
    };
  }
}
