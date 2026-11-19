import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInvite } from "@/components/AcceptInvite";

export const metadata: Metadata = { title: "Convite", referrer: "no-referrer", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AcceptInvite />
    </Suspense>
  );
}
