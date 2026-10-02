import { RequestStateMachine } from './request-state-machine';
import { RequestStatus } from '../../../generated/prisma';

describe('RequestStateMachine', () => {
  const machine = new RequestStateMachine();
  const transition = (currentStatus: RequestStatus, targetStatus: RequestStatus, metadata: Record<string, any> = {}, reason?: string) =>
    machine.transition({ requestId: 'request-1', currentStatus, targetStatus, metadata, reason });

  describe('a failed move', () => {
    it.each([RequestStatus.DOWNLOADING, RequestStatus.PENDING, RequestStatus.FOUND, RequestStatus.FAILED, RequestStatus.EXPIRED])(
      'holds a request that was %s when its download landed',
      async status => {
        expect((await transition(status, RequestStatus.ORGANIZE_FAILED)).success).toBe(true);
      },
    );

    it('does not hold a request that is mid-search, cancelled or already complete', async () => {
      for (const status of [RequestStatus.SEARCHING, RequestStatus.CANCELLED, RequestStatus.COMPLETED]) {
        expect((await transition(status, RequestStatus.ORGANIZE_FAILED)).success).toBe(false);
      }
    });

    it('is left by completing, or by going back to pending', async () => {
      expect((await transition(RequestStatus.ORGANIZE_FAILED, RequestStatus.COMPLETED)).success).toBe(true);
      expect((await transition(RequestStatus.ORGANIZE_FAILED, RequestStatus.PENDING)).success).toBe(true);
    });

    it('cannot be cancelled or searched, which would delete or duplicate its files', async () => {
      expect((await transition(RequestStatus.ORGANIZE_FAILED, RequestStatus.CANCELLED)).success).toBe(false);
      expect((await transition(RequestStatus.ORGANIZE_FAILED, RequestStatus.SEARCHING)).success).toBe(false);
    });
  });

  describe('completing without a download', () => {
    it.each([RequestStatus.PENDING, RequestStatus.FOUND, RequestStatus.FAILED, RequestStatus.CANCELLED, RequestStatus.EXPIRED])(
      'is allowed from %s only when the files were organized by hand',
      async status => {
        expect((await transition(status, RequestStatus.COMPLETED)).success).toBe(false);
        expect((await transition(status, RequestStatus.COMPLETED, { manuallyOrganized: true })).success).toBe(true);
      },
    );
  });
});
