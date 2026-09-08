import { NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { getSponsorReferralStatus } from "@/lib/sponsors";

export async function GET() {
  try {
    const auth = await requireStaffAuth();
    const admin = getSupabaseAdminClient();
    const { data: sponsor } = await admin.from("sponsors").select("id,campaign_id,display_name,is_minor,guardian_approved").eq("auth_user_id", auth.userId).eq("is_active", true).maybeSingle();
    if (!sponsor) return NextResponse.json({ error: "No active ambassador profile is linked to this account." }, { status: 404 });
    const referrals = await getSponsorReferralStatus(sponsor.id);
    return NextResponse.json({ sponsor, referrals: referrals.map(({ cases, ...item }) => ({ ...item, stageCounts: cases.reduce<Record<string, number>>((all, entry) => ({ ...all, [entry.stage]: (all[entry.stage] ?? 0) + 1 }), {}) })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Ambassador authentication required." }, { status: 401 });
  }
}
