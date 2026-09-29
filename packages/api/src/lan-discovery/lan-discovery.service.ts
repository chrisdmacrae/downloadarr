import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSocket, RemoteInfo, Socket } from 'dgram';
import { hostname } from 'os';

/** What a client broadcasts to find downloadarr. Modelled on Jellyfin's "who is JellyfinServer?". */
export const DISCOVERY_QUESTION = 'who is Downloadarr?';
export const DEFAULT_DISCOVERY_PORT = 7360; // one above Jellyfin's 7359

/**
 * Reply payload. There's deliberately no host address by default: inside
 * Docker the API can't know the host's LAN IP, so clients combine the
 * address the reply came from with `Port`. Set LAN_DISCOVERY_ADVERTISED_URL
 * to override that (e.g. behind a reverse proxy).
 */
export interface DiscoveryReply {
  Id: string;
  Name: string;
  Version: string;
  /** Port the HTTP API listens on. */
  Port: number;
  /** Full API base URL, only when explicitly configured. */
  Address?: string;
}

/**
 * Answers LAN discovery broadcasts so clients (e.g. TV and J) can find
 * downloadarr without the user typing an address. Publish the UDP port
 * from Docker (`7360:7360/udp`) for broadcasts to reach the container.
 */
@Injectable()
export class LanDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LanDiscoveryService.name);
  private socket?: Socket;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>('LAN_DISCOVERY_ENABLED', 'true') === 'false') {
      this.logger.log('LAN discovery disabled (LAN_DISCOVERY_ENABLED=false)');
      return;
    }

    const port = Number(this.config.get<string>('LAN_DISCOVERY_PORT', String(DEFAULT_DISCOVERY_PORT)));
    const socket = createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('message', (message, remote) => this.respond(message, remote));
    socket.on('error', (error) => {
      // Discovery is a convenience; never let it take the API down.
      this.logger.warn(`LAN discovery unavailable: ${error.message}`);
      socket.close();
      this.socket = undefined;
    });
    socket.bind(port, () => this.logger.log(`Answering LAN discovery on udp/${port}`));

    this.socket = socket;
  }

  onModuleDestroy() {
    this.socket?.close();
    this.socket = undefined;
  }

  /** The reply for an incoming datagram, or null if it isn't a discovery question. */
  replyFor(message: string): DiscoveryReply | null {
    if (message.trim().toLowerCase() !== DISCOVERY_QUESTION.toLowerCase()) return null;

    const advertised = this.config.get<string>('LAN_DISCOVERY_ADVERTISED_URL');
    return {
      Id: this.config.get<string>('LAN_DISCOVERY_ID') ?? hostname(),
      Name: 'Downloadarr',
      Version: this.config.get<string>('APP_VERSION', 'latest'),
      Port: Number(this.config.get<string>('PORT', '3001')),
      ...(advertised ? { Address: advertised.replace(/\/+$/, '') } : {}),
    };
  }

  private respond(message: Buffer, remote: RemoteInfo) {
    const reply = this.replyFor(message.toString('utf8'));
    if (!reply || !this.socket) return;
    this.socket.send(Buffer.from(JSON.stringify(reply)), remote.port, remote.address, (error) => {
      if (error) this.logger.debug(`Discovery reply to ${remote.address} failed: ${error.message}`);
    });
  }
}
