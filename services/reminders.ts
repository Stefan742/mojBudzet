import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * Local reminders for repeating transactions: one notification at 9:00 on
 * the day something is due. Scheduled on the device only; nothing is sent
 * anywhere. Not available on web, or in Expo Go on Android (see below).
 */

const CHANNEL_ID = "repeating";
const ID_PREFIX = "repeating:";
export const REMINDER_HOUR = 9;

// Expo Go on Android no longer ships expo-notifications (SDK 53+) and merely
// importing it throws, which took the whole root layout down. Store and
// development builds have it; there the module is loaded on first use.
const inExpoGoAndroid = Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const supported = Platform.OS !== "web" && !inExpoGoAndroid;

type NotificationsModule = typeof import("expo-notifications");
let loaded: NotificationsModule | null = null;
const notifications = (): NotificationsModule =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (loaded ??= require("expo-notifications") as NotificationsModule);

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
  notifications().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    await notifications().setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: notifications().AndroidImportance.DEFAULT,
    });
  }
}

/** Asks once, at a moment that makes sense (the first repeating transaction). */
export async function requestReminderPermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await notifications().getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await notifications().requestPermissionsAsync()).granted;
}

/** Notifications were turned off for the app in the system settings. */
export async function remindersBlocked(): Promise<boolean> {
  if (!supported) return false;
  const current = await notifications().getPermissionsAsync();
  return !current.granted && !current.canAskAgain;
}

/** Replaces every scheduled reminder with `reminders` (pass [] to clear). */
export async function scheduleReminders(reminders: Reminder[]): Promise<void> {
  if (!supported) return;
  const scheduled = await notifications().getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => notifications().cancelScheduledNotificationAsync(n.identifier))
  );
  if (!reminders.length || !(await notifications().getPermissionsAsync()).granted) return;
  const now = Date.now();
  await Promise.all(
    reminders
      .filter((r) => r.date.getTime() > now)
      .map((r) =>
        notifications().scheduleNotificationAsync({
          identifier: `${ID_PREFIX}${r.key}`,
          content: { title: r.title, body: r.body },
          trigger: { type: notifications().SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL_ID },
        })
      )
  );
}

/** Calls `onOpen` when the user taps a reminder. Returns the unsubscribe function. */
export function onReminderTapped(onOpen: () => void): () => void {
  if (!supported) return () => undefined;
  const subscription = notifications().addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.identifier.startsWith(ID_PREFIX)) onOpen();
  });
  return () => subscription.remove();
}
