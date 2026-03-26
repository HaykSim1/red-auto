/**
 * Android channel for remote pushes. Must match:
 * - mobile `ANDROID_PUSH_CHANNEL_ID` / `setNotificationChannelAsync`
 * - app.json `plugins` → `expo-notifications` → `defaultChannel`
 */
export const ANDROID_PUSH_CHANNEL_ID = 'zapchast-alerts';
