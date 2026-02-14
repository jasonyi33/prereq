import { Server } from "socket.io";

// Use globalThis so the Socket.IO instance is shared between the Express server
// and Next.js API routes (which are bundled as separate modules by Next.js).
const g = globalThis as unknown as {
  __socketIO?: Server;
  __lectureStudents?: Map<string, Set<string>>;
  __socketMeta?: Map<string, { lectureId: string; studentId?: string }>;
};

// In-memory map: lectureId → Set of studentIds
if (!g.__lectureStudents) g.__lectureStudents = new Map();
if (!g.__socketMeta) g.__socketMeta = new Map();
const lectureStudents = g.__lectureStudents;
const socketMeta = g.__socketMeta;

export function getIO(): Server | null {
  return g.__socketIO || null;
}

export function getStudentsInLecture(lectureId: string): string[] {
  const set = lectureStudents.get(lectureId);
  return set ? Array.from(set) : [];
}

export function setupSocket(ioServer: Server): void {
  g.__socketIO = ioServer;

  ioServer.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("lecture:join", (payload: { lectureId: string; role: string; studentId?: string }) => {
      const { lectureId, role, studentId } = payload;

      // Everyone joins the lecture room
      socket.join(`lecture:${lectureId}`);

      if (role === "professor") {
        socket.join(`professor:${lectureId}`);
      }

      if (role === "student" && studentId) {
        socket.join(`student:${studentId}`);

        // Track student in lecture
        if (!lectureStudents.has(lectureId)) {
          lectureStudents.set(lectureId, new Set());
        }
        lectureStudents.get(lectureId)!.add(studentId);
      }

      // Clean up previous lecture if socket is re-joining
      const prev = socketMeta.get(socket.id);
      if (prev?.studentId) {
        const prevSet = lectureStudents.get(prev.lectureId);
        if (prevSet) {
          prevSet.delete(prev.studentId);
          if (prevSet.size === 0) {
            lectureStudents.delete(prev.lectureId);
          }
        }
      }

      // Store socket metadata for disconnect cleanup
      socketMeta.set(socket.id, { lectureId, studentId });

      console.log(`Socket ${socket.id} joined lecture:${lectureId} as ${role}${studentId ? ` (student: ${studentId})` : ""}`);
    });

    socket.on("disconnect", () => {
      const meta = socketMeta.get(socket.id);
      if (meta?.studentId) {
        const set = lectureStudents.get(meta.lectureId);
        if (set) {
          set.delete(meta.studentId);
          if (set.size === 0) {
            lectureStudents.delete(meta.lectureId);
          }
        }
      }
      socketMeta.delete(socket.id);
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
