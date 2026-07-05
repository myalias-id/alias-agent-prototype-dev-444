import dynamic from 'next/dynamic';

export const runtime = 'edge';

const AgentChat = dynamic(
  () => import('@/components/agent').then((mod) => mod.AgentChat),
  {
    ssr: false,
  }
);

export default function Page() {
  return <AgentChat />;
}
