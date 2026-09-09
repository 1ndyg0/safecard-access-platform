import { NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/auth/session";
import { requireAnyRole } from "@/lib/auth/permissions";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/audit";
import { handleApiError } from "@/lib/api/response";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStaffAuth();
    const { id } = await context.params;
    const admin = getSupabaseAdminClient();
    const { data: caseRecord } = await admin.from("recipient_cases").select("*").eq("id", id).single();
    if (!caseRecord) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    const access = await requireAnyRole(auth.userId, ["privacy_admin_owner", "school_admin", "prc_liaison"], caseRecord.campaign_id);
    if (!access.allowed) return NextResponse.json({ error: "Permission denied." }, { status: 403 });
    const { data: profile } = await admin.from("recipient_profiles").select("first_name,middle_name,last_name,date_of_birth,sex,address_line1,address_line2,city,province,zip_code,mobile_number,email,fields_completed,updated_at").eq("case_id", id).maybeSingle();
    const { data: payments } = await admin.from("payment_intents").select("id,expected_amount,payment_route,state,payment_reference,created_at,updated_at").eq("case_id", id).order("created_at", { ascending: false });
    const paymentIds = (payments ?? []).map((payment) => payment.id);
    const { data: evidence } = paymentIds.length ? await admin.from("payment_evidence_versions").select("id,payment_evidence_id,payment_intent_id,version_number,content_type,file_size_bytes,sha256,state,uploaded_at,reviewed_at,retention_review_at,metadata").in("payment_intent_id", paymentIds).order("uploaded_at", { ascending: false }) : { data: [] };
    const { data: auditEvents, error: auditError } = await admin.from("audit_events").select("id,event_type,action,severity,created_at,target_type,target_id").eq("case_id", id).order("created_at", { ascending: false }).limit(100);
    if (auditError) throw new Error(`Audit history could not be loaded: ${auditError.message}`);
    await writeAuditEvent({ event_type: "staff_access", actor_id: auth.userId, actor_type: "user", action: "Viewed authorized case detail", case_id: id, campaign_id: caseRecord.campaign_id, target_type: "recipient_case", target_id: id });
    return NextResponse.json({ case: caseRecord, profile, payments: payments ?? [], evidence: evidence ?? [], auditEvents: auditEvents ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleApiError(error, "Admin case detail");
  }
}
