import type { Metadata } from "next";
import { DatabaseView } from "@/components/DatabaseView";

export const metadata: Metadata = { title: "Projetos" };

export default function Page() {
  return <DatabaseView db="projetos" />;
}
