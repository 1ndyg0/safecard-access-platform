import { Suspense } from "react";
import { ApplicationsList } from "@/components/admin/ApplicationsList";

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<p>Loading applications…</p>}>
      <ApplicationsList />
    </Suspense>
  );
}
