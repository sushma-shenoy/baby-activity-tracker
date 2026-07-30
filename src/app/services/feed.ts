import { Injectable } from '@angular/core';

export interface Feed {
  id: string;
  time: string;
  quantity: number;
  type: 'expressed' | 'formula';
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
      const value = JSON.parse(localStorage.getItem(this.key) || '[]');
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
    feeds.unshift(this.normalize(feed));
    localStorage.setItem(this.key, JSON.stringify(feeds));
    return true;
  }

  // ❌ DELETE FEED
  deleteFeed(id: string) {
    const feeds = this.getFeeds().filter(f => f.id !== id);
    localStorage.setItem(this.key, JSON.stringify(feeds));
  }

  // 📊 COUNT (useful for dashboard later)
  count(): number {
    return this.getFeeds().length;
  }
  saveAll(feeds: Feed[]): void {
    localStorage.setItem(
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
      /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.time)
    );
  }

  private normalize(feed: Feed): Feed {
    return {
      ...feed,
      quantity: Number(feed.quantity)
    };
  }
}
