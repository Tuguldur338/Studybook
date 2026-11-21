import { Suspense } from "react";
import { TeacherProfileRoute } from "@/components/teacher-views";

export default function TeacherPage() {
  return (
    <Suspense fallback={<p className="field-hint">Loading teacher profile...</p>}>
      <TeacherProfileRoute />
    </Suspense>
  );
}
