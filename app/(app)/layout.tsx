import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { one } from "@/lib/db";
import { BottomNav } from "@/app/components/BottomNav";
import { BrandBar } from "@/app/components/BrandBar";
import { InstallPrompt } from "@/app/components/InstallPrompt";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/welcome");

  const member = await one<{ consent_at: string | null }>(
    `select consent_at from members where id = $1`,
    [session.memberId]
  );
  if (member && !member.consent_at) redirect("/onboarding");

  return (
    <>
      <BrandBar />
      {children}
      <BottomNav />
      <InstallPrompt />
    </>
  );
}
