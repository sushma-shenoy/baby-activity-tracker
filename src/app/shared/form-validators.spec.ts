import { FormControl } from '@angular/forms';
import {
  calendarDateValidator,
  notFutureDateTimeValidator,
  trimmedRequiredValidator,
  validDateTimeValidator
} from './form-validators';

describe('shared form validators', () => {
  it('rejects text containing only whitespace', () => {
    const control = new FormControl('   ', {
      validators: trimmedRequiredValidator()
    });

    expect(control.hasError('required')).toBeTrue();
  });

  it('rejects impossible calendar dates', () => {
    const control = new FormControl('2025-02-30', {
      validators: calendarDateValidator()
    });

    expect(control.hasError('invalidDate')).toBeTrue();
  });

  it('accepts a real calendar date', () => {
    const control = new FormControl('2024-02-29', {
      validators: calendarDateValidator()
    });

    expect(control.valid).toBeTrue();
  });

  it('rejects invalid and future date-time values', () => {
    const invalid = new FormControl('not-a-date', {
      validators: validDateTimeValidator()
    });
    const future = new FormControl('2999-01-01T12:00', {
      validators: notFutureDateTimeValidator()
    });

    expect(invalid.hasError('invalidDateTime')).toBeTrue();
    expect(future.hasError('futureDateTime')).toBeTrue();
  });
});
