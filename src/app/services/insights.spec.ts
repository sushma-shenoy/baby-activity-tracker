import { TestBed } from '@angular/core/testing';

import { Insights } from './insights';

describe('Insights', () => {
  let service: Insights;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Insights);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
