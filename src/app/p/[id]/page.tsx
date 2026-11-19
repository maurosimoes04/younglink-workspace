import { Suspense } from "react";
import { PageView } from "@/components/PageView";

export default function Page() {
  return (
    <Suspense fallback={<div className="px-6 py-16 text-sm text-faint">A carregar…</div>}>
      <PageView />
    </Suspense>
  );
}
