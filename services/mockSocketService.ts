// Mock implementation for testing without a server
export const socket = {
  connected: true,
  emit: (event: string, ...args: any[]) => {
    console.log(`Mock socket emitting: ${event}`, args);
    // Simulate responses
    if (event === 'iniciar_llamada' && args[0]) {
      setTimeout(() => {
        const handlers = socket.listeners['llamada_aceptada'];
        handlers?.forEach(handler => handler(args[0]));
      }, 2000);
    }
  },
  on: (event: string, handler: any) => {
    console.log(`Mock socket listening for: ${event}`);
    if (!socket.listeners[event]) {
      socket.listeners[event] = [];
    }
    socket.listeners[event].push(handler);
  },
  off: (event: string, handler: any) => {
    console.log(`Mock socket removing listener for: ${event}`);
    if (socket.listeners[event]) {
      socket.listeners[event] = socket.listeners[event]
        .filter((h: any) => h !== handler);
    }
  },
  listeners: {} as Record<string, any[]>,
};
