import { TestBed } from '@angular/core/testing';
import { MilestoneService } from './milestone.service';

describe('MilestoneService', () => {
  let service: MilestoneService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(MilestoneService);
  });

  it('saves and deletes a milestone', () => {
    service.save({
      id: 'one',
      title: 'First smile',
      category: 'social',
      achievedDate: '2024-01-01',
      notes: '',
      createdAt: 1
    });
    expect(service.milestones.length).toBe(1);
    service.delete('one');
    expect(service.milestones).toEqual([]);
  });

  it('rejects a future milestone date', () => {
    expect(() =>
      service.save({
        id: 'future',
        title: 'Future event',
        category: 'other',
        achievedDate: '2999-01-01',
        notes: '',
        createdAt: 1
      })
    ).toThrow();
  });
});
