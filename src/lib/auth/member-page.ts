import "server-only";

import { redirect } from "next/navigation";
import { requireMemberSession } from "./member-session";

/**
 * Gate for member pages rendered on the server. A visitor without a valid
 * member session is sent to the member sign-in before any member content is
 * built. The pages behind it hold no personal data, so the gate is about
 * access (members only), not secrecy of the text.
 */
export async function requireMemberPage(): Promise<void> {
  try {
    await requireMemberSession();
  } catch {
    redirect("/member");
  }
}
