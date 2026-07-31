import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const LATE_REMINDER_MINUTES = 15;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Lembretes de medicamento',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: asked } = await Notifications.requestPermissionsAsync();
  return asked === 'granted';
}

function nextOccurrence(scheduledTime: string) {
  const [h, m] = scheduledTime.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  return target;
}

export interface DoseNotificationIds {
  notifyId?: string;
  lateNotifyId?: string;
}

// expo-notifications has no web implementation at all (every call throws
// UnavailabilityError there) — skip it on web instead of letting that throw
// bubble up as an unhandled rejection on every dose list refresh.
export async function scheduleDoseNotifications(
  patientName: string,
  medName: string,
  medDosage: string,
  scheduledTime: string
): Promise<DoseNotificationIds> {
  if (Platform.OS === 'web') return {};
  const doseAt = nextOccurrence(scheduledTime);
  const lateAt = new Date(doseAt.getTime() + LATE_REMINDER_MINUTES * 60000);

  const notifyId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Hora do medicamento — ${patientName}`,
      body: `${medName} · ${medDosage} — ${scheduledTime}`,
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: doseAt },
  });

  const lateNotifyId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Medicamento atrasado — ${patientName}`,
      body: `${medName} ainda não foi tomado — já se passaram ${LATE_REMINDER_MINUTES} minutos.`,
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: lateAt },
  });

  return { notifyId, lateNotifyId };
}

export async function notifyNow(title: string, body: string) {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: null,
  });
}

export async function cancelDoseNotifications(ids: DoseNotificationIds) {
  if (Platform.OS === 'web') return;
  if (ids.notifyId) await Notifications.cancelScheduledNotificationAsync(ids.notifyId);
  if (ids.lateNotifyId) await Notifications.cancelScheduledNotificationAsync(ids.lateNotifyId);
}
