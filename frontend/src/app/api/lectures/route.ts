import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";

export async function POST(req: NextRequest) {
  const { courseId, title } = await req.json();

  const { data, error } = await supabase
    .from("lecture_sessions")
    .insert({ course_id: courseId, title, status: "live" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // In demo mode, automatically start the transcript simulator
  if (process.env.DEMO_MODE === "true") {
    try {
      const { startSimulator } = await import("@server/simulator");
      startSimulator(data.id, data.course_id);
    } catch {
      // Simulator not available — that's fine
    }
  }

  return NextResponse.json({
    id: data.id,
    courseId: data.course_id,
    title: data.title,
    status: data.status,
  });
}
