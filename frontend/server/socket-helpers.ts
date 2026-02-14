import { getIO, getStudentsInLecture } from "./socket";

export function emitToLectureRoom(lectureId: string, event: string, data: unknown): void {
  try {
    getIO().to(`lecture:${lectureId}`).emit(event, data);
  } catch (e) {
    console.warn(`Socket emit failed (${event}):`, e);
  }
}

export function emitToStudent(studentId: string, event: string, data: unknown): void {
  try {
    getIO().to(`student:${studentId}`).emit(event, data);
  } catch (e) {
    console.warn(`Socket emit failed (${event}):`, e);
  }
}

export function emitToProfessor(lectureId: string, event: string, data: unknown): void {
  try {
    getIO().to(`professor:${lectureId}`).emit(event, data);
  } catch (e) {
    console.warn(`Socket emit failed (${event}):`, e);
  }
}

export { getStudentsInLecture };
