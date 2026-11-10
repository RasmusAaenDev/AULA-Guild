const formatter = new Intl.DateTimeFormat('da-DK', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Copenhagen',
});

export function formatDateTime(date: Date | null): string {
  return date ? formatter.format(date) : 'Ikke synkroniseret endnu';
}
