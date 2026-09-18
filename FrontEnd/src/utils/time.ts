// Helpers de tempo compartilhados entre Dashboard e tela de Alerta.

export function minutesLate(scheduledTime: string) {
  const [h, m] = scheduledTime.split(':').map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  return Math.max(1, Math.round((Date.now() - scheduled.getTime()) / 60000));
}

// "há 32 min" / "há 2h 15min" (omite minutos quando zero: "há 3h") / "há 1 dia" / "há 2 dias"
export function formatLate(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `há ${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `há ${h}h` : `há ${h}h ${rem}min`;
  }
  const days = Math.floor(m / 1440);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

export type DayBucket = 'today' | 'tomorrow' | 'later';

export function dayBucketFor(scheduledAt: string): DayBucket {
  const target = new Date(scheduledAt);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  return 'later';
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Rótulo curto pro caso raro de doses além de amanhã (preenchimento da agenda com dias futuros).
export function laterDayLabel(scheduledAt: string) {
  const date = new Date(scheduledAt);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${WEEKDAY_LABELS[date.getDay()]} ${dd}/${mm}`;
}

export function dayWord(bucket: DayBucket, scheduledAt: string) {
  if (bucket === 'today') return 'hoje';
  if (bucket === 'tomorrow') return 'amanhã';
  return laterDayLabel(scheduledAt);
}
