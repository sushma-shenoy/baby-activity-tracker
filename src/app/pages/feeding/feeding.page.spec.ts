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
});
