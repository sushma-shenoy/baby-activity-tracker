import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SleepPage } from './sleep.page';

describe('SleepPage', () => {
  let component: SleepPage;
  let fixture: ComponentFixture<SleepPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SleepPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
