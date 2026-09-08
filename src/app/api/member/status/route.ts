import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/auth/member-session";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { memberNextAction } from "@/lib/member/status";

export async function GET() {
  try {
    const { caseId } = await requireMemberSession();
    const { data, error } = await getSupabaseAdminClient().from("recipient_cases")
      .select("application_ref, application_state, payment_state, prc_handoff_state, membership_state, updated_at")
      .eq("id", caseId).single();
    if (error || !data) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    return NextResponse.json({ reference: data.application_ref, states: data, nextAction: memberNextAction(data), hotline: "143" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Member authentication required." }, { status: 401 });
  }
}
