import { NextRequest, NextResponse } from "next/server";
import { flaskGet } from "@/lib/flask";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  const { pollId } = await params;

  const responses = await flaskGet<
    { answer: string; evaluation: { eval_result?: string } | null }[]
  >(`/api/polls/${pollId}/responses`);

  const totalResponses = responses?.length || 0;
  const distribution = { green: 0, yellow: 0, red: 0 };

  for (const r of responses || []) {
    const evalResult = r.evaluation?.eval_result;
    if (evalResult === "correct") distribution.green++;
    else if (evalResult === "partial") distribution.yellow++;
    else if (evalResult === "wrong") distribution.red++;
  }

  return NextResponse.json({ totalResponses, distribution });
}
