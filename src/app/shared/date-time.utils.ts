const TIME_24_PATTERN =
  /^([01]\d|2[0-3]):([0-5]\d)$/;

export function formatTime24(
  date: Date
): string {
  const hours = String(
    date.getHours()
  ).padStart(2, '0');
  const minutes = String(
    date.getMinutes()
  ).padStart(2, '0');

  return `${hours}:${minutes}`;
}

export function dateForTimeToday(
  time: string,
  today = new Date()
): Date | null {
  const match =
    TIME_24_PATTERN.exec(time);

  if (!match) {
    return null;
  }

  const date = new Date(today);
  date.setHours(
    Number(match[1]),
    Number(match[2]),
    0,
    0
  );

  return date;
}

export function isValidTime24(
  time: string
): boolean {
  return TIME_24_PATTERN.test(time);
}
