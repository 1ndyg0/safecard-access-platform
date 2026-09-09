import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/auth/member-session";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { memberNextAction } from "@/lib/member/status";

export async function GET() {
  try {
    const { caseId } = await requireMemberSession();
    const { data, error } = await getSupabaseAdminClient().from("recipient_cases")
      .select("id,campaign_id,application_ref,application_state,application_review_state,application_review_reason,payment_state,prc_handoff_state,membership_state,updated_at")
      .eq("id", caseId).single();
    if (error || !data) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const admin = getSupabaseAdminClient();
    const { data: payment } = await admin.from("payment_intents").select("id,expected_amount,payment_reference,state").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { data: evidence } = payment ? await admin.from("payment_evidence_versions").select("id,state,metadata").eq("payment_intent_id", payment.id).order("version_number", { ascending: false }).limit(1).maybeSingle() : { data: null };
    const reuploadReason = evidence?.state === "reupload_requested" && evidence.metadata && typeof evidence.metadata === "object" ? String((evidence.metadata as Record<string, unknown>).reupload_reason ?? "Please replace the payment evidence.") : null;
    return NextResponse.json({
      reference: data.application_ref,
      states: data,
      nextAction: memberNextAction(data),
      hotline: "143",
      applicationReview: { state: data.application_review_state, reason: data.application_review_reason },
      paymentCorrection: reuploadReason && payment ? { caseId, campaignId: data.campaign_id, paymentIntentId: payment.id, amount: Number(payment.expected_amount), referenceNumber: payment.payment_reference, reason: reuploadReason, dataMode: process.env.LAUNCH_GATES_COMPLETE === "true" ? "live" : "synthetic" } : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Member authentication required." }, { status: 401 });
  }
}
