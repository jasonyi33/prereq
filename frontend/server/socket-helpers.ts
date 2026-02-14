import { getIO, getStudentsInLecture } from "./socket";

export function emitToLectureRoom(lectureId: string, event: string, data: unknown): void {
  const io = getIO();
  if (!io) return;
  io.to(`lecture:${lectureId}`).emit(event, data);
}

export function emitToStudent(studentId: string, event: string, data: unknown): void {
  const io = getIO();
  if (!io) return;
  io.to(`student:${studentId}`).emit(event, data);
}

export function emitToProfessor(lectureId: string, event: string, data: unknown): void {
  const io = getIO();
  if (!io) return;
  io.to(`professor:${lectureId}`).emit(event, data);
}

export { getStudentsInLecture };
