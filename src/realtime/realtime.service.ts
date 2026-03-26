import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Bridges domain services to the WebSocket server after gateway init.
 * Security: JWT validated on connect in RealtimeGateway (query ?token= or handshake.auth.token).
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  attach(server: Server): void {
    this.server = server;
  }

  emit(event: string, payload: unknown): void {
    this.server?.emit(event, payload);
  }

  emitToRequestRoom(requestId: string, event: string, payload: unknown): void {
    this.server?.to(`request:${requestId}`).emit(event, payload);
  }
}
