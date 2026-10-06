import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';

jest.mock('@app/common', () => ({ User: () => () => undefined }));

describe('PresenceController', () => {
  let controller: PresenceController;
  let mockPresenceService: any;

  beforeEach(() => {
    mockPresenceService = {
      recordHeartbeat: jest.fn().mockResolvedValue(undefined),
      getPresenceStream: jest
        .fn()
        .mockReturnValue(of({ data: { type: 'presence:update' } })),
      getWorkspacePresence: jest.fn().mockResolvedValue({ user_1: 'online' }),
    };

    controller = new PresenceController(mockPresenceService as PresenceService);
  });

  describe('heartbeat', () => {
    it('should call recordHeartbeat and return success', async () => {
      const dto: HeartbeatDto = {
        status: 'online',
        workspaceId: 'ws_1',
      };

      const result = await controller.heartbeat('user_1', dto);

      expect(result).toEqual({ success: true });
      expect(mockPresenceService.recordHeartbeat).toHaveBeenCalledWith('user_1', dto);
    });
  });

  describe('stream', () => {
    it('should throw BadRequestException if workspaceId is missing', () => {
      expect(() => controller.stream('')).toThrow(BadRequestException);
    });

    it('should call getPresenceStream with workspaceId', (done) => {
      const stream$ = controller.stream('ws_1');

      expect(mockPresenceService.getPresenceStream).toHaveBeenCalledWith('ws_1');
      stream$.subscribe((event) => {
        expect(event).toBeDefined();
        done();
      });
    });
  });

  describe('getWorkspacePresence', () => {
    it('should return workspace presence snapshot', async () => {
      const result = await controller.getWorkspacePresence('ws_1');

      expect(result).toEqual({ presence: { user_1: 'online' } });
      expect(mockPresenceService.getWorkspacePresence).toHaveBeenCalledWith('ws_1');
    });
  });
});
