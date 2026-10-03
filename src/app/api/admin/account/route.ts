import { getSessionClient, requireStaffAuth } from '@/lib/auth/session';
import { requireAnyStaffRole } from '@/lib/auth/permissions';
import { success, forbidden, handleApiError } from '@/lib/api/response';

export async function GET() {
  try {
    const auth = await requireStaffAuth();
    const role = await requireAnyStaffRole(auth.userId);
    if (!role.allowed) return forbidden(role.reason);
    const client = await getSessionClient();
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) throw new Error('Could not verify staff session assurance');
    return success({ email: auth.email, assuranceLevel: data.currentLevel });
  } catch (error) {
    return handleApiError(error, 'Staff account');
  }
}
