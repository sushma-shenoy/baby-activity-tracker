import { TestBed } from '@angular/core/testing';

import { FeedService } from './feed';

describe('FeedService', () => {
  let service: FeedService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('rejects an invalid feed', () => {
    expect(service.addFeed({
      id: 'feed-1',
      type: 'formula',
      quantity: 0,
      time: 'not-a-time'
    })).toBeFalse();
    expect(service.getFeeds()).toEqual([]);
  });

  it('ignores malformed stored feeds', () => {
    localStorage.setItem('feeds', JSON.stringify([
      {
        id: 'bad-feed',
        type: 'formula',
        quantity: 'many',
        time: '25:90'
      }
    ]));

    expect(service.getFeeds()).toEqual([]);
  });
});
