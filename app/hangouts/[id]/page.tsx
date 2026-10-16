import { redirect } from 'next/navigation';
export const metadata = { referrer: 'no-referrer' as const };
export default async function InvitationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invite?: string }> }) {
  const { id } = await params;
  const { invite } = await searchParams;
  const query = new URLSearchParams({ hangout: id });
  if (invite && /^[a-f0-9]{64}$/.test(invite)) query.set('invite', invite);
  redirect(`/account/hangouts?${query}`);
}
