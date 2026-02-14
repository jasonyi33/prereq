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

  return NextResponse.json({
    id: data.id,
    courseId: data.course_id,
    title: data.title,
    status: data.status,
  });
}
