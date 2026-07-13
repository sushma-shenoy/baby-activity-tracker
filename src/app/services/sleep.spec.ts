import { TestBed } from '@angular/core/testing';

import { Sleep } from './sleep';

describe('Sleep', () => {
  let service: Sleep;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sleep);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
