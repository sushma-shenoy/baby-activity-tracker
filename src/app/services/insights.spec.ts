import { TestBed } from '@angular/core/testing';

import { InsightService } from './insights';

describe('InsightService', () => {
  let service: InsightService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InsightService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('reports solid meals separately from milk feeds', () => {
    const now = Date.now();
    const analytics =
      service.calculateDailyAnalytics([
        {
          id: 'solid-1',
          type: 'solids',
          title: 'Solid food',
          value: 'Banana · Some · Liked',
          time: '12:00',
          createdAt: now
        },
        {
          id: 'feed-1',
          type: 'feeding',
          title: 'Feeding',
          value: '120 ml · Formula',
          time: '13:00',
          createdAt: now
        }
      ]);

    expect(analytics.solids.count).toBe(1);
    expect(analytics.feeding.count).toBe(1);
    expect(
      analytics.feeding.totalAmountMl
    ).toBe(120);
    expect(analytics.solids.foods)
      .toEqual(['Banana']);
    expect(analytics.solids.likedCount)
      .toBe(1);

    const message =
      service.createInsightMessages(
        analytics,
        service.compareDays(
          analytics,
          service.calculateDailyAnalytics(
            [],
            new Date(Date.now() - 86_400_000)
          )
        )
      ).find(
        insight =>
          insight.type === 'solids'
      );

    expect(message?.message)
      .toContain('Foods offered: Banana');
  });
});
