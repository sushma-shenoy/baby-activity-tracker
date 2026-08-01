import { TestBed } from '@angular/core/testing';
import {
  SolidFoodService
} from './solid-food.service';

describe('SolidFoodService', () => {
  let service: SolidFoodService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(
      SolidFoodService
    );
  });

  it('saves a valid solid food entry', () => {
    expect(service.save({
      id: 'solid-1',
      foods: 'Banana and oatmeal',
      amount: 'some',
      reaction: 'liked',
      notes: 'Soft texture',
      eatenAt: Date.now()
    })).toBeTrue();

    expect(service.entries.length).toBe(1);
    expect(service.entries[0].foods)
      .toBe('Banana and oatmeal');
  });

  it('rejects an empty food name', () => {
    expect(service.save({
      id: 'solid-1',
      foods: ' ',
      amount: 'some',
      reaction: 'neutral',
      notes: '',
      eatenAt: Date.now()
    })).toBeFalse();
  });
});
