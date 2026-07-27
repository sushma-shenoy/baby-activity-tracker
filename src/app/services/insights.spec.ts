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
});
