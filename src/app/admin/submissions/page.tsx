import { Suspense } from "react";
import { SubmissionsTable } from "@/components/admin/SubmissionsTable";

export default function SubmissionsPage() {
  return <Suspense fallback={<p>Loading submissions…</p>}><SubmissionsTable /></Suspense>;
}
