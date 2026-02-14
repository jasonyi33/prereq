import { Server } from "socket.io";

let io: Server;

export function getIO(): Server {
  return io;
}

export function setupSocket(ioServer: Server): void {
  io = ioServer;

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
