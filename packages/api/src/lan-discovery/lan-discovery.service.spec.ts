import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createSocket } from 'dgram';
import { AddressInfo } from 'net';
import { DISCOVERY_QUESTION, LanDiscoveryService } from './lan-discovery.service';

describe('LanDiscoveryService', () => {
  let service: LanDiscoveryService;
  let env: Record<string, string | undefined>;

  beforeEach(async () => {
    env = { PORT: '3001', APP_VERSION: '1.2.3', LAN_DISCOVERY_ID: 'nas', LAN_DISCOVERY_PORT: '0' };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanDiscoveryService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback) },
        },
      ],
    }).compile();
    service = module.get(LanDiscoveryService);
  });

  afterEach(() => service.onModuleDestroy());

  describe('replyFor', () => {
    it('answers the discovery question with the API port', () => {
      expect(service.replyFor(DISCOVERY_QUESTION)).toEqual({ Id: 'nas', Name: 'Downloadarr', Version: '1.2.3', Port: 3001 });
    });

    it('is forgiving about case and surrounding whitespace', () => {
      expect(service.replyFor('  WHO IS DOWNLOADARR?\n')).not.toBeNull();
    });

    it('ignores anything else, including Jellyfin discovery', () => {
      expect(service.replyFor('who is JellyfinServer?')).toBeNull();
      expect(service.replyFor('')).toBeNull();
    });

    it('includes an advertised URL only when configured, without a trailing slash', () => {
      env.LAN_DISCOVERY_ADVERTISED_URL = 'https://downloadarr.example.com/api/';
      expect(service.replyFor(DISCOVERY_QUESTION)?.Address).toBe('https://downloadarr.example.com/api');
    });
  });

  it('replies over UDP to whoever asked', async () => {
    service.onModuleInit();
    const server = (service as unknown as { socket: ReturnType<typeof createSocket> }).socket;
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const { port } = server.address() as AddressInfo;

    const client = createSocket('udp4');
    const reply = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no reply')), 2000);
      client.once('message', (msg) => {
        clearTimeout(timer);
        resolve(msg.toString('utf8'));
      });
      client.send(DISCOVERY_QUESTION, port, '127.0.0.1');
    });
    client.close();

    expect(JSON.parse(reply)).toMatchObject({ Name: 'Downloadarr', Port: 3001 });
  });

  it('stays off when disabled', () => {
    env.LAN_DISCOVERY_ENABLED = 'false';
    service.onModuleInit();
    expect((service as unknown as { socket?: unknown }).socket).toBeUndefined();
  });
});
