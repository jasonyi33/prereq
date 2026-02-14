import { NextResponse } from "next/server";
import { flaskGet } from "@/lib/flask";

export async function GET() {
  try {
    const data = await flaskGet<{ status: string }>("/api/health");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Flask API unreachable" },
      { status: 500 }
    );
  }
}
