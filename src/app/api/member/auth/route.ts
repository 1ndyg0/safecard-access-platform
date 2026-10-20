import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { handleApiError } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { createMemberToken, MEMBER_COOKIE, memberCookieOptions } from "@/lib/auth/member-session";

const schema = z.object({
  // Optional: only used by automated tests to pick one case when several share a number.
  referenceNumber: z.string().trim().toUpperCase().regex(/^SC-\d{4}-[A-Z0-9]{8}$/).optional(),
  mobileNumber: z.string().trim().regex(/^(09|\+639)\d{9}$/),
});

const NO_MATCH = "We could not find an application for that mobile number. Call Hotline 143 if you need help.";

// 09XXXXXXXXX and +639XXXXXXXXX are the same number; match either stored form.
function mobileVariants(mobile: string) {
  const local = mobile.startsWith("+63") ? `0${mobile.slice(3)}` : mobile;
  return [local, `+63${local.slice(1)}`];
}

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "member-login", 5, 300);
    const input = schema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    let query = admin.from("recipient_cases")
      .select("id, recipient_profiles!inner(mobile_number)")
      .in("recipient_profiles.mobile_number", mobileVariants(input.mobileNumber))
      .eq("is_active", true);
    if (input.referenceNumber) query = query.eq("application_ref", input.referenceNumber);
    const { data: records } = await query.limit(2);
    if (!records || records.length === 0) {
      return NextResponse.json({ error: NO_MATCH }, { status: 401 });
    }
    if (records.length > 1) {
      // Never guess between two people's applications.
      return NextResponse.json({ error: "More than one application uses this mobile number. Please call Hotline 143 so staff can help you sign in." }, { status: 409 });
    }
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(MEMBER_COOKIE, createMemberToken(records[0].id), memberCookieOptions);
    return response;
  } catch (error) {
    return handleApiError(error, "Member login");
  }
}
