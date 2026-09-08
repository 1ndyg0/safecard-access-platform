import { redirect } from "next/navigation";

export default async function ReviewCompatibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/submissions/${id}`);
}
