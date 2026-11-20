import type { Metadata } from "next";
import { Suspense } from "react";
import { Panel } from "@/components/Panel";

export const metadata: Metadata = { title: "Painel", referrer: "no-referrer", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <Panel />
    </Suspense>
  );
}
