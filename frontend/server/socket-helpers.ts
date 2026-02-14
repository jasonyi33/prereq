import { getIO, getStudentsInLecture } from "./socket";

export function emitToLectureRoom(lectureId: string, event: string, data: any): void {
  getIO().to(`lecture:${lectureId}`).emit(event, data);
}

export function emitToStudent(studentId: string, event: string, data: any): void {
  getIO().to(`student:${studentId}`).emit(event, data);
}

export function emitToProfessor(lectureId: string, event: string, data: any): void {
  getIO().to(`professor:${lectureId}`).emit(event, data);
}

export { getStudentsInLecture };
