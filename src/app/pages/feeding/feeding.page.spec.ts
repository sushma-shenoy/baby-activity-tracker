import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedingPage } from './feeding.page';

describe('FeedingPage', () => {
  let component: FeedingPage;
  let fixture: ComponentFixture<FeedingPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FeedingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('summarizes left and right nursing time from the last 24 hours', () => {
    component.nursingSessions = [
      {
        id: 'recent',
        startedAt: Date.now() - 60_000,
        endedAt: Date.now(),
        leftSeconds: 600,
        rightSeconds: 300,
        lastSide: 'right',
        notes: ''
      },
      {
        id: 'old',
        startedAt: Date.now() - 172_800_000,
        endedAt: Date.now() - 172_000_000,
        leftSeconds: 900,
        rightSeconds: 900,
        lastSide: 'left',
        notes: ''
      }
    ];

    expect(component.nursingSummary24Hours.count).toBe(1);
    expect(component.nursingSummary24Hours.totalSeconds).toBe(900);
    expect(component.nursingSummary24Hours.leftPercent).toBe(67);
    expect(component.nursingSummary24Hours.rightPercent).toBe(33);
  });
});
