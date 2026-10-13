import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * Local reminders for repeating transactions: one notification at 9:00 on
 * the day something is due. Scheduled on the device only; nothing is sent
 * anywhere. Not available on web.
 */

const CHANNEL_ID = "repeating";
const ID_PREFIX = "repeating:";
export const REMINDER_HOUR = 9;

const supported = Platform.OS !== "web";

export interface Reminder {
  /** Unique per rule and day, so rescheduling replaces rather than duplicates. */
  key: string;
  title: string;
  body: string;
  date: Date;
}

/** Show reminders that arrive while the app is open; create the Android channel. */
export async function setUpReminders(channelName: string): Promise<void> {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Asks once, at a moment that makes sense (the first repeating transaction). */
export async function requestReminderPermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Notifications were turned off for the app in the system settings. */
export async function remindersBlocked(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  return !current.granted && !current.canAskAgain;
}

/** Replaces every scheduled reminder with `reminders` (pass [] to clear). */
export async function scheduleReminders(reminders: Reminder[]): Promise<void> {
  if (!supported) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  if (!reminders.length || !(await Notifications.getPermissionsAsync()).granted) return;
  const now = Date.now();
  await Promise.all(
    reminders
      .filter((r) => r.date.getTime() > now)
      .map((r) =>
        Notifications.scheduleNotificationAsync({
          identifier: `${ID_PREFIX}${r.key}`,
          content: { title: r.title, body: r.body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL_ID },
        })
      )
  );
}

/** Calls `onOpen` when the user taps a reminder. Returns the unsubscribe function. */
export function onReminderTapped(onOpen: () => void): () => void {
  if (!supported) return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.identifier.startsWith(ID_PREFIX)) onOpen();
  });
  return () => subscription.remove();
}
