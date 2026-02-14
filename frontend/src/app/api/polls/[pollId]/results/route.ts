import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  const { pollId } = await params;

  const { data: responses } = await supabase
    .from("poll_responses")
    .select("evaluation")
    .eq("question_id", pollId);

  const totalResponses = responses?.length || 0;
  const distribution = { green: 0, yellow: 0, red: 0 };

  for (const r of responses || []) {
    const evalResult = (r as { evaluation: { eval_result?: string } | null })
      .evaluation?.eval_result;
    if (evalResult === "correct") distribution.green++;
    else if (evalResult === "partial") distribution.yellow++;
    else if (evalResult === "wrong") distribution.red++;
  }

  return NextResponse.json({ totalResponses, distribution });
}
