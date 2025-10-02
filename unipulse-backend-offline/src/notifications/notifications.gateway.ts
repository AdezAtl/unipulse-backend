import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class NotificationsGateway {
  @WebSocketServer() server: Server;

  notifyUser(userId: string, payload: any) {
    this.server.to(userId).emit('notification', payload);
  }

  // Example client message handler (not required)
  @SubscribeMessage('join')
  handleJoin(client: any, payload: { userId: string }) {
    client.join(payload.userId);
    return { joined: payload.userId };
  }
}