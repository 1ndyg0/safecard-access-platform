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
    const { count: cases } = selected ? await admin.from("recipient_cases").select("id", { count: "exact", head: true }).eq("campaign_id", selected.id) : { count: 0 };
    const { count: submitted } = selected ? await admin.from("recipient_cases").select("id", { count: "exact", head: true }).eq("campaign_id", selected.id).in("application_state", ["submitted", "resubmitted"]) : { count: 0 };
    const { count: active } = selected ? await admin.from("recipient_cases").select("id", { count: "exact", head: true }).eq("campaign_id", selected.id).eq("membership_state", "active_confirmed") : { count: 0 };
    return NextResponse.json({ user, roles: assignments?.map((item) => item.role) ?? [], campaigns: campaigns ?? [], selectedCampaignId: selected?.id ?? null, metrics: { cases: cases ?? 0, submitted: submitted ?? 0, active: active ?? 0 } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
  }
}
