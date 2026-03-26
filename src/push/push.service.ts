import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { Repository } from 'typeorm';
import { Device } from '../database/entities/device.entity';
import { UserRole } from '../database/enums';
import { ANDROID_PUSH_CHANNEL_ID } from './push.constants';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo: Expo | null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
  ) {
    const token = config.get<string>('EXPO_ACCESS_TOKEN')?.trim();
    this.expo = token ? new Expo({ accessToken: token }) : null;
  }

  async sendToUserIds(
    userIds: string[],
    message: Pick<ExpoPushMessage, 'title' | 'body' | 'data'>,
  ): Promise<void> {
    if (!this.expo || userIds.length === 0) return;

    const unique = await this.devices
      .createQueryBuilder('d')
      .where('d.user_id IN (:...ids)', { ids: userIds })
      .getMany();

    const tokens = [...new Set(unique.map((d) => d.expoPushToken))];
    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t))
      .map((to) => ({
        to,
        sound: 'default',
        priority: 'high',
        channelId: ANDROID_PUSH_CHANNEL_ID,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
      }));

    if (!messages.length) return;

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
    } catch (e) {
      this.logger.warn(`Expo push failed: ${(e as Error).message}`);
    }
  }

  /**
   * Send a single test notification to all registered Expo tokens for a user.
   * Used by admin tooling and manual QA (requires EXPO_ACCESS_TOKEN on the API).
   */
  async sendTestToUser(userId: string): Promise<{
    ok: boolean;
    reason?:
      | 'expo_not_configured'
      | 'no_devices'
      | 'no_valid_tokens'
      | 'send_failed';
    devices_registered: number;
    messages_sent: number;
    error?: string;
    hint?: string;
  }> {
    if (!this.expo) {
      return {
        ok: false,
        reason: 'expo_not_configured',
        devices_registered: 0,
        messages_sent: 0,
        hint:
          'Set EXPO_ACCESS_TOKEN in api/.env (Expo: expo.dev → account → Access tokens), restart the API, then retry.',
      };
    }

    const rows = await this.devices
      .createQueryBuilder('d')
      .where('d.user_id = :id', { id: userId })
      .getMany();

    const devices_registered = rows.length;
    if (devices_registered === 0) {
      return {
        ok: false,
        reason: 'no_devices',
        devices_registered: 0,
        messages_sent: 0,
        hint:
          'No POST /devices row for this user. On the phone, log in as this exact user (same UUID as admin if you left the field empty), open Profile → enable push, and ensure EXPO_PUBLIC_API_URL hits this API. Or paste the mobile user’s id from Users.',
      };
    }

    const tokens = [...new Set(rows.map((r) => r.expoPushToken))];
    const valid = tokens.filter((t) => Expo.isExpoPushToken(t));
    if (valid.length === 0) {
      return {
        ok: false,
        reason: 'no_valid_tokens',
        devices_registered,
        messages_sent: 0,
        hint:
          'Device rows exist but stored tokens are not valid Expo push tokens. Re-register from the app (Profile → push) after a clean install or simulator reset.',
      };
    }

    const messages: ExpoPushMessage[] = valid.map((to) => ({
      to,
      sound: 'default',
      priority: 'high',
      channelId: ANDROID_PUSH_CHANNEL_ID,
      title: 'Zapchast test',
      body: 'Push notifications are working.',
      data: { type: 'test' },
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      let messages_sent = 0;
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
        messages_sent += chunk.length;
      }
      return { ok: true, devices_registered, messages_sent };
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.warn(`Expo push test failed: ${msg}`);
      return {
        ok: false,
        reason: 'send_failed',
        devices_registered,
        messages_sent: 0,
        error: msg,
      };
    }
  }

  /**
   * Notify sellers (and admins) with registered devices when a new open request is posted.
   * Buyers are excluded so they are not spammed; the author is always excluded.
   */
  async broadcastNewRequest(
    excludeUserId: string,
    data: Record<string, string>,
  ): Promise<void> {
    if (!this.expo) return;
    const rows = await this.devices
      .createQueryBuilder('d')
      .innerJoin('d.user', 'u')
      .select('d.user_id', 'userId')
      .where('d.user_id != :id', { id: excludeUserId })
      .andWhere('u.role IN (:...roles)', {
        roles: [UserRole.SELLER, UserRole.ADMIN],
      })
      .distinct(true)
      .getRawMany<{ userId: string }>();
    const ids = [...new Set(rows.map((r) => r.userId))];
    await this.sendToUserIds(ids, {
      title: 'New part request',
      body: 'A new open request was posted in the marketplace.',
      data: { ...data, type: 'request.created' },
    });
  }
}
