import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance || !socketInstance.connected) {
    const token = getAuthToken();
    if (!socketInstance) {
      socketInstance = io(window.location.origin, {
        auth: { token },
        withCredentials: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
      });
    } else if (token) {
      socketInstance.auth = { token };
      socketInstance.connect();
    }
  }
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
