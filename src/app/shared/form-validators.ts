import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn
} from '@angular/forms';

export function trimmedRequiredValidator(): ValidatorFn {
  return (
    control: AbstractControl<unknown>
  ): ValidationErrors | null => {
    if (typeof control.value !== 'string') {
      return null;
    }

    return control.value.trim().length > 0
      ? null
      : { required: true };
  };
}

export function calendarDateValidator(): ValidatorFn {
  return (
    control: AbstractControl<unknown>
  ): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }

    if (typeof control.value !== 'string') {
      return { invalidDate: true };
    }

    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(control.value);
    if (!match) {
      return { invalidDate: true };
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);

    return (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    )
      ? null
      : { invalidDate: true };
  };
}

export function validDateTimeValidator(): ValidatorFn {
  return (
    control: AbstractControl<unknown>
  ): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }

    const timestamp = new Date(String(control.value)).getTime();
    return Number.isFinite(timestamp)
      ? null
      : { invalidDateTime: true };
  };
}

export function notFutureDateTimeValidator(
  toleranceMilliseconds = 60_000
): ValidatorFn {
  return (
    control: AbstractControl<unknown>
  ): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }

    const timestamp = new Date(String(control.value)).getTime();
    return Number.isFinite(timestamp) &&
      timestamp <= Date.now() + toleranceMilliseconds
      ? null
      : { futureDateTime: true };
  };
}

