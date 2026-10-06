import { firstValueFrom } from 'rxjs';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let service: PresenceService;
  let mockRedis: any;
  let mockPipeline: any;

  beforeEach(() => {
    mockPipeline = {
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    mockRedis = {
      pipeline: jest.fn().mockReturnValue(mockPipeline),
      smembers: jest.fn(),
      mget: jest.fn(),
      srem: jest.fn().mockResolvedValue(1),
    };

    service = new PresenceService(mockRedis);
  });

  describe('recordHeartbeat', () => {
    it('should set presence key with 60s TTL and add user to workspace set', async () => {
      const dto: HeartbeatDto = {
        status: 'online',
        workspaceId: 'ws_1',
      };

      await service.recordHeartbeat('user_1', dto);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.set).toHaveBeenCalledWith(
        'presence:user:user_1',
        expect.stringContaining('"status":"online"'),
        'EX',
        60,
      );
      expect(mockPipeline.sadd).toHaveBeenCalledWith(
        'presence:workspace:ws_1:users',
        'user_1',
      );
      expect(mockPipeline.expire).toHaveBeenCalledWith(
        'presence:workspace:ws_1:users',
        7 * 24 * 3600,
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('getWorkspacePresence', () => {
    it('should return empty object if no users are in workspace set', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await service.getWorkspacePresence('ws_empty');

      expect(result).toEqual({});
      expect(mockRedis.mget).not.toHaveBeenCalled();
    });

    it('should return presence map and prune expired users', async () => {
      mockRedis.smembers.mockResolvedValue(['user_1', 'user_2']);
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({ status: 'online', lastSeen: Date.now(), workspaceId: 'ws_1' }),
        null, // expired
      ]);

      const result = await service.getWorkspacePresence('ws_1');

      expect(result).toEqual({
        user_1: 'online',
        user_2: 'offline',
      });
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'presence:workspace:ws_1:users',
        'user_2',
      );
    });
  });

  describe('getUsersPresence', () => {
    it('should return empty object if user list is empty', async () => {
      const result = await service.getUsersPresence([]);
      expect(result).toEqual({});
    });

    it('should return presence map for given user IDs', async () => {
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({ status: 'away', lastSeen: Date.now(), workspaceId: 'ws_1' }),
        null,
      ]);

      const result = await service.getUsersPresence(['user_1', 'user_2']);

      expect(result).toEqual({
        user_1: 'away',
        user_2: 'offline',
      });
    });
  });

  describe('getPresenceStream', () => {
    it('should emit initial presence data in MessageEvent format', async () => {
      mockRedis.smembers.mockResolvedValue(['user_1']);
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({ status: 'online', lastSeen: Date.now(), workspaceId: 'ws_1' }),
      ]);

      const event = await firstValueFrom(service.getPresenceStream('ws_1'));

      expect(event).toBeDefined();
      expect(event.data).toMatchObject({
        type: 'presence:update',
        workspaceId: 'ws_1',
        presence: { user_1: 'online' },
      });
    });
  });
});
