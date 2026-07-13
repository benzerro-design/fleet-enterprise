import { PartnerInviteAcceptClient } from "./PartnerInviteAcceptClient";

type PageProps = { params: Promise<{ token: string }> };

export default async function PartnerInvitePage({ params }: PageProps) {
  const { token } = await params;
  return (
    <main className="min-h-dvh bg-zinc-950 px-4 py-16 text-zinc-100">
      <PartnerInviteAcceptClient token={token} />
    </main>
  );
}
