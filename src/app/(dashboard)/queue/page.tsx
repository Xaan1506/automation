import { Suspense } from "react";
import { QueuePage } from "@/components/pages/queue-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading queue...</div>}>
      <QueuePage />
    </Suspense>
  );
}
