import { NextResponse } from "next/server";
import { supabase } from "@server/db";

export async function GET() {
  const { data, error } = await supabase
    .from("courses")
    .select("id")
    .limit(1);

  if (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "ok", data });
}
