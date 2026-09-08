import { NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/db/client";

export async function GET() {
  try {
    const auth = await requireStaffAuth();
    const admin = getSupabaseAdminClient();
    const { data: user } = await admin.from("users").select("full_name,email").eq("id", auth.userId).single();
    const { data: assignments } = await admin.from("role_assignments")
      .select("role,campaign_id,organization_id").eq("user_id", auth.userId).eq("is_active", true).is("revoked_at", null);
    const campaignIds = [...new Set((assignments ?? []).map((item) => item.campaign_id).filter(Boolean))] as string[];
    const organizationIds = [...new Set((assignments ?? []).map((item) => item.organization_id).filter(Boolean))] as string[];
    let campaignQuery = admin.from("pilot_campaigns").select("id,name,organization_id,is_active,max_applications");
    if (campaignIds.length && organizationIds.length) campaignQuery = campaignQuery.or(`id.in.(${campaignIds.join(",")}),organization_id.in.(${organizationIds.join(",")})`);
    else if (campaignIds.length) campaignQuery = campaignQuery.in("id", campaignIds);
    else if (organizationIds.length) campaignQuery = campaignQuery.in("organization_id", organizationIds);
    else return NextResponse.json({ error: "No active staff assignment." }, { status: 403 });
    const { data: campaigns } = await campaignQuery;
    const selected = campaigns?.[0];
    const countState = async (column: string, values: string[]) => {
      if (!selected) return 0;
      const result = await admin.from("recipient_cases").select("id", { count: "exact", head: true }).eq("campaign_id", selected.id).in(column, values);
      return result.count ?? 0;
    };
    const [cases, drafts, submitted, awaitingReview, correction, paymentPending, paymentVerified, readyForHandoff, sentToPrc, active, declined] = await Promise.all([
      selected ? admin.from("recipient_cases").select("id", { count: "exact", head: true }).eq("campaign_id", selected.id).then((result) => result.count ?? 0) : Promise.resolve(0),
      countState("application_state", ["draft", "ready_for_review"]),
      countState("application_state", ["submitted", "resubmitted"]),
      countState("application_state", ["submitted", "resubmitted"]),
      countState("application_state", ["correction_needed"]),
      countState("payment_state", ["official_handoff_opened", "payer_marked_paid", "verification_pending"]),
      countState("payment_state", ["verified_by_official_source"]),
      countState("prc_handoff_state", ["ready_for_export"]),
      countState("prc_handoff_state", ["exported", "acknowledged"]),
      countState("membership_state", ["active_confirmed"]),
      countState("membership_state", ["declined"]),
    ]);
    return NextResponse.json({ user, roles: assignments?.map((item) => item.role) ?? [], campaigns: campaigns ?? [], selectedCampaignId: selected?.id ?? null, metrics: { cases, drafts, submitted, awaitingReview, correction, paymentPending, paymentVerified, readyForHandoff, sentToPrc, active, declined } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
  }
}
