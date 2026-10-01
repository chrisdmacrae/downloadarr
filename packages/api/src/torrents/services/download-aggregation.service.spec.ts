import { DownloadAggregationService } from './download-aggregation.service';

describe('DownloadAggregationService.isDownloadFailed', () => {
  const setup = (getStatus: jest.Mock) => new DownloadAggregationService({} as any, { getStatus } as any);

  it('reports an errored download', async () => {
    const service = setup(jest.fn().mockResolvedValue({ status: 'error', errorMessage: 'disk full' }));
    expect(await service.isDownloadFailed('gid')).toEqual({ failed: true, reason: 'disk full' });
  });

  it('reports a download aria2 has forgotten', async () => {
    const service = setup(jest.fn().mockRejectedValue(new Error('GID gid is not found')));
    expect((await service.isDownloadFailed('gid')).failed).toBe(true);
  });

  it('does not fail a download because aria2 could not be reached', async () => {
    const service = setup(jest.fn().mockRejectedValue(new Error('Aria2 RPC not connected')));
    expect((await service.isDownloadFailed('gid')).failed).toBe(false);
  });
});
