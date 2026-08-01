import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InsightsPage } from './insights.page';

describe('InsightsPage', () => {
  let component: InsightsPage;
  let fixture: ComponentFixture<InsightsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(InsightsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds seven days of chart data when the page loads', () => {
    expect(component.weeklyAnalytics.days.length).toBe(7);

    const chartColumns =
      fixture.nativeElement.querySelectorAll(
        '.bar-column'
      );

    expect(chartColumns.length).toBe(35);
  });
});
