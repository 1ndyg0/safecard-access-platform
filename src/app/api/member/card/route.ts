import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireMemberSession } from "@/lib/auth/member-session";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { isAdministratorApproved, maskMobile } from "@/lib/member/approved";
import { benefitStoryboards } from "@/lib/benefit-storyboards";

type ApprovedProfile = { first_name: string; last_name: string; mobile_number: string | null; city: string | null; province: string | null };

export async function GET() {
  try {
    const { caseId } = await requireMemberSession();
    const admin = getSupabaseAdminClient();
    const { data: record, error } = await admin.from("recipient_cases")
      .select("application_ref, membership_state, application_review_state, payment_state, recipient_profiles!inner(first_name,last_name,mobile_number,city,province)")
      .eq("id", caseId).single();
    if (error || !record) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (record.membership_state !== "active_confirmed") {
      // Administrator-approved: approval + verified payment, no PRC handoff needed for this pilot.
      // This is NOT PRC-confirmed membership and the card says so.
      if (isAdministratorApproved(record)) {
        const approvedProfiles = record.recipient_profiles as unknown as ApprovedProfile | ApprovedProfile[];
        const approvedProfile = Array.isArray(approvedProfiles) ? approvedProfiles[0] : approvedProfiles;
        const { data: decision } = await admin.from("application_review_decisions")
          .select("decided_at").eq("case_id", caseId).eq("decision", "approved")
          .order("decided_at", { ascending: false }).limit(1).maybeSingle();
        const approvedQr = await QRCode.toDataURL(JSON.stringify({ type: "safecard-administrator-approved", reference: record.application_ref }), { margin: 1, width: 360, errorCorrectionLevel: "M" });
        return NextResponse.json({
          active: false,
          approved: true,
          reference: record.application_ref,
          name: `${approvedProfile.first_name} ${approvedProfile.last_name}`,
          mobileMasked: maskMobile(approvedProfile.mobile_number),
          location: [approvedProfile.city, approvedProfile.province].filter(Boolean).join(", "),
          approvedAt: decision?.decided_at ?? null,
          qrDataUrl: approvedQr,
          benefits: benefitStoryboards.map((benefit) => ({ id: benefit.id, icon: benefit.icon, title: benefit.title, summary: benefit.summary })),
        }, { headers: { "Cache-Control": "private, no-store" } });
      }
      return NextResponse.json({ active: false, reference: record.application_ref, membershipState: record.membership_state }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const { data: event } = await admin.from("membership_status_events")
      .select("prc_membership_id,prc_effective_date,prc_expiry_date")
      .eq("case_id", caseId).eq("new_state", "active_confirmed")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!event?.prc_membership_id) return NextResponse.json({ error: "PRC confirmation evidence is incomplete." }, { status: 409 });
    const profiles = record.recipient_profiles as unknown as { first_name: string; last_name: string } | { first_name: string; last_name: string }[];
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;
    const qrPayload = JSON.stringify({ type: "safecard-prc-confirmed", membershipId: event.prc_membership_id });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 360, errorCorrectionLevel: "M" });
    return NextResponse.json({ active: true, name: `${profile.first_name} ${profile.last_name}`, reference: record.application_ref, membershipId: event.prc_membership_id, effectiveDate: event.prc_effective_date, expiryDate: event.prc_expiry_date, qrDataUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Member authentication required." }, { status: 401 });
  }
}
