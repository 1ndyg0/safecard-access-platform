import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { badRequest, handleApiError } from '@/lib/api/response';

const schema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) });
const message = 'If this email belongs to an active staff account, a recovery link will be sent. Check your inbox and spam folder.';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'staff.password.recovery', 5, 300);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return badRequest('Enter a valid staff email address.');
    const admin = getSupabaseAdminClient();
    const { data: profile, error } = await admin.from('users').select('id')
      .eq('email', parsed.data.email).eq('is_active', true).maybeSingle();
    if (error) throw new Error('Staff recovery lookup unavailable');
    if (profile) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) throw new Error('Staff recovery origin unavailable');
      const { error: deliveryError } = await admin.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${new URL(appUrl).origin}/admin/account`,
      });
      // Same public result for unknown accounts and failed deliveries. Never
      // disclose account membership or provider errors containing addresses.
      if (deliveryError) console.error('[staff-recovery] Auth email delivery failed');
    }
    return NextResponse.json({ message }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return handleApiError(error, 'Staff password recovery');
  }
}
