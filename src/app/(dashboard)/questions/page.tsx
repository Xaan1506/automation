import { Suspense } from "react";
import { QuestionsPage } from "@/components/pages/questions-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading questions...</div>}>
      <QuestionsPage />
    </Suspense>
  );
}
