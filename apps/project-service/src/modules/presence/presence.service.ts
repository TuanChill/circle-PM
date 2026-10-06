import { Inject, Injectable, Logger } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Observable, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { REDIS_CLIENT } from './presence.constants';

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface UserPresenceData {
  status: 'online' | 'away';
  lastSeen: number;
  workspaceId: string;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private static readonly PRESENCE_TTL_SECONDS = 60;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private getUserKey(userId: string): string {
    return `presence:user:${userId}`;
  }

  private getWorkspaceSetKey(workspaceId: string): string {
    return `presence:workspace:${workspaceId}:users`;
  }

  async recordHeartbeat(userId: string, dto: HeartbeatDto): Promise<void> {
    try {
      const userKey = this.getUserKey(userId);
      const workspaceKey = this.getWorkspaceSetKey(dto.workspaceId);
      const data: UserPresenceData = {
        status: dto.status,
        lastSeen: Date.now(),
        workspaceId: dto.workspaceId,
      };

      const pipeline = this.redis.pipeline();
      pipeline.set(
        userKey,
        JSON.stringify(data),
        'EX',
        PresenceService.PRESENCE_TTL_SECONDS,
      );
      pipeline.sadd(workspaceKey, userId);
      // Give workspace set key a 7-day TTL so orphaned keys don't accumulate indefinitely
      pipeline.expire(workspaceKey, 7 * 24 * 3600);
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(
        `Failed to record presence heartbeat for user ${userId}: ${error.message}`,
      );
    }
  }

  async getWorkspacePresence(
    workspaceId: string,
  ): Promise<Record<string, PresenceStatus>> {
    try {
      const workspaceKey = this.getWorkspaceSetKey(workspaceId);
      const userIds = await this.redis.smembers(workspaceKey);

      if (!userIds || userIds.length === 0) {
        return {};
      }

      const keys = userIds.map((id) => this.getUserKey(id));
      const values = await this.redis.mget(keys);

      const result: Record<string, PresenceStatus> = {};
      const expiredUserIds: string[] = [];

      userIds.forEach((userId, index) => {
        const val = values[index];
        if (val) {
          try {
            const parsed = JSON.parse(val) as UserPresenceData;
            result[userId] = parsed.status;
          } catch {
            result[userId] = 'online';
          }
        } else {
          result[userId] = 'offline';
          expiredUserIds.push(userId);
        }
      });

      // Lazily cleanup expired users from the workspace set
      if (expiredUserIds.length > 0) {
        this.redis.srem(workspaceKey, ...expiredUserIds).catch((err) => {
          this.logger.debug(
            `Failed to clean expired users from workspace set: ${err.message}`,
          );
        });
      }

      return result;
    } catch (error) {
      this.logger.warn(
        `Failed to retrieve workspace presence for ${workspaceId}: ${error.message}`,
      );
      return {};
    }
  }

  async getUsersPresence(userIds: string[]): Promise<Record<string, PresenceStatus>> {
    if (!userIds || userIds.length === 0) {
      return {};
    }

    try {
      const keys = userIds.map((id) => this.getUserKey(id));
      const values = await this.redis.mget(keys);

      const result: Record<string, PresenceStatus> = {};
      userIds.forEach((userId, index) => {
        const val = values[index];
        if (val) {
          try {
            const parsed = JSON.parse(val) as UserPresenceData;
            result[userId] = parsed.status;
          } catch {
            result[userId] = 'online';
          }
        } else {
          result[userId] = 'offline';
        }
      });

      return result;
    } catch (error) {
      this.logger.warn(`Failed to get presence for users: ${error.message}`);
      return {};
    }
  }

  getPresenceStream(workspaceId: string): Observable<MessageEvent> {
    // Emits immediately upon connection, then every 10s
    return timer(0, 10000).pipe(
      switchMap(() => this.getWorkspacePresence(workspaceId)),
      map(
        (presence) =>
          ({
            data: {
              type: 'presence:update',
              workspaceId,
              presence,
              timestamp: Date.now(),
            },
          }) as MessageEvent,
      ),
    );
  }
}
