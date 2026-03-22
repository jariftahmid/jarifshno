
import { io, Socket } from 'socket.io-client';

// In a real app, this would be your signaling server URL
// For demo purposes, we'll try to connect to the same origin
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
});
