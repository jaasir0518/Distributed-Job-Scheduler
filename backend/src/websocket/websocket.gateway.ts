import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('WebsocketGateway');

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastJobUpdate(jobId: string, status: string, queueId: string) {
    this.server.emit('job:updated', { jobId, status, queueId });
  }

  broadcastWorkerUpdate(workerId: string, status: string, name: string) {
    this.server.emit('worker:updated', { workerId, status, name });
  }

  broadcastMetricsUpdate(projectId: string, metrics: any) {
    this.server.emit(`metrics:${projectId}`, metrics);
  }
}
