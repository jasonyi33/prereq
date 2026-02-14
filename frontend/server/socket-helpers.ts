/**
 * Socket.IO helper functions for emitting events to specific rooms/clients.
 *
 * STUB: Person 4 will replace this with the real implementation that uses
 * the Socket.IO server instance and room management.
 */

import { getIO } from "./socket";

export function emitToLectureRoom(
  lectureId: string,
  event: string,
  data: unknown
): void {
  try {
    getIO().to(`lecture:${lectureId}`).emit(event, data);
  } catch (e) {
    console.warn(`Socket emit failed (${event}):`, e);
  }
}

export function emitToStudent(
  studentId: string,
  event: string,
  data: unknown
): void {
  try {
    getIO().to(`student:${studentId}`).emit(event, data);
  } catch (e) {
    console.warn(`Socket emit failed (${event}):`, e);
  }
}

export function emitToProfessor(
  lectureId: string,
  event: string,
  data: unknown
): void {
  try {
    getIO().to(`professor:${lectureId}`).emit(event, data);
  } catch (e) {
    console.warn(`Socket emit failed (${event}):`, e);
  }
}

export function getStudentsInLecture(lectureId: string): string[] {
  // TODO: Person 4 implements real room tracking
  // For now returns empty — attendance boost won't apply until P4 wires this up
  return [];
}
