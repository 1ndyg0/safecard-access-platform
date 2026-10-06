import { getSessionClient, requireStaffAuth } from '@/lib/auth/session';
import { resolveStaffScope } from '@/lib/admin/access';
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
    const scope = await resolveStaffScope();
    return success({ email: auth.email, assuranceLevel: data.currentLevel,
      navigation: {
        staff: scope.roles.some((role) => ['privacy_admin_owner', 'school_admin'].includes(role)),
        export: scope.roles.some((role) => ['finance_export', 'school_admin', 'prc_liaison', 'privacy_admin_owner'].includes(role)),
      },
    });
  } catch (error) {
    return handleApiError(error, 'Staff account');
  }
}
