import SynchroApp from '@/components/synchro-app';
import { authConfigured } from '@/lib/server/config';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const params = await searchParams;
  return <SynchroApp liveEnabled={authConfigured() && params.demo !== '1'} />;
}
