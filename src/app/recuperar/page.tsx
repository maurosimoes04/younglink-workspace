import type { Metadata } from "next";
import { ForgotPassword } from "@/components/ForgotPassword";

export const metadata: Metadata = { title: "Recuperar palavra-passe" };

export default function Page() {
  return <ForgotPassword />;
}
