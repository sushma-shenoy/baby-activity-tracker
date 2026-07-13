import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiaperPage } from './diaper.page';

describe('DiaperPage', () => {
  let component: DiaperPage;
  let fixture: ComponentFixture<DiaperPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DiaperPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
