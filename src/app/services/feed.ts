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
    const feeds = JSON.parse(localStorage.getItem(this.key) || '[]') as
      Array<Feed | (Omit<Feed, 'type'> & { type: 'breast' })>;
    return feeds.map(feed => ({
      ...feed,
      type: feed.type === 'breast' ? 'expressed' : feed.type
    }));
  }

  // ➕ ADD FEED
  addFeed(feed: Feed) {
    const feeds = this.getFeeds();
    feeds.unshift(feed);
    localStorage.setItem(this.key, JSON.stringify(feeds));
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
  saveAll(feeds: Feed[]) {
  localStorage.setItem(this.key, JSON.stringify(feeds));
}
}
