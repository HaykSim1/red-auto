import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserRole } from '../database/enums';
import { RealtimeService } from './realtime.service';

interface WsJwtPayload {
  sub: string;
  role: UserRole;
  phone_verified?: boolean;
}

@WebSocketGateway({
  path: '/realtime',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit() {
    this.realtime.attach(this.server);
  }

  async handleConnection(client: Socket) {
    const raw =
      (typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null) ??
      (typeof client.handshake.query?.token === 'string'
        ? client.handshake.query.token
        : null);
    if (!raw) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<WsJwtPayload>(raw, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      client.data.userId = payload.sub;
      client.data.role = payload.role;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channel?: string },
  ) {
    const ch = body?.channel;
    if (!ch?.startsWith('request:')) return { ok: false };
    void client.join(ch);
    return { ok: true };
  }
}
