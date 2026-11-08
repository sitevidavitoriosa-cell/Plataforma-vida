import { Protegido } from "@/components/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Protegido>{children}</Protegido>;
}
