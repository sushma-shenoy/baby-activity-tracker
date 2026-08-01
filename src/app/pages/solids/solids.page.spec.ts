import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';
import { SolidsPage } from './solids.page';

describe('SolidsPage', () => {
  let component: SolidsPage;
  let fixture: ComponentFixture<SolidsPage>;

  beforeEach(() => {
    localStorage.clear();
    fixture =
      TestBed.createComponent(SolidsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the separate solids tracker', () => {
    expect(component).toBeTruthy();
  });

  it('logs a solid meal', () => {
    component.foods = 'Avocado';
    component.amount = 'most';
    component.reaction = 'liked';

    component.save();

    expect(component.errorMessage).toBe('');
    expect(component.entries.length).toBe(1);
    expect(component.entries[0].foods)
      .toBe('Avocado');
  });

  it('combines selected and custom foods', () => {
    component.toggleFood('Banana');
    component.toggleFood('Oatmeal');
    component.foods = 'Homemade puree';

    expect(component.combinedFoods).toBe(
      'Banana, Oatmeal, Homemade puree'
    );

    component.save();

    expect(component.entries[0].foods).toBe(
      'Banana, Oatmeal, Homemade puree'
    );
  });
});
