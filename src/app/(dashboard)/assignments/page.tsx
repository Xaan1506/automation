import { Suspense } from "react";
import { AssignmentsPage } from "@/components/pages/assignments-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading assignments...</div>}>
      <AssignmentsPage />
    </Suspense>
  );
}
