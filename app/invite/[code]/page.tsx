import RecipientFlow from "@/components/RecipientFlow";

export default async function InvitationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RecipientFlow code={code} />;
}
