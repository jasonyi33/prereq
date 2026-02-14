"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(typeof window !== "undefined" ? window.location.origin : "", {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function useSocket(): Socket {
  return getSocket();
}

export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void,
): void {
  const s = useSocket();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const fn = (data: T) => handlerRef.current(data);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [s, event]);
}
