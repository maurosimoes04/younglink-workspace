import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInvite } from "@/components/AcceptInvite";

export const metadata: Metadata = { title: "Nova palavra-passe", referrer: "no-referrer", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AcceptInvite mode="reset" />
    </Suspense>
  );
}
