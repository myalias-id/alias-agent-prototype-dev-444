import { IAgent } from '@/types/agent';

async function getMetadata() {
  try {
    const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID;

    if (!AGENT_ID) {
      return null;
    }

    // Use absolute URL for server-side fetching

    const backendUrl = `${process.env.AGENT_BACKEND_API_BASE_URL}/agent/${Number(AGENT_ID)}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BACKEND_API_ADMIN_SECRET}`,
      },
    });

    if (!backendResponse.ok) {
      return null;
    }

    const data = await backendResponse.json();

    const agent: IAgent | null =
      data?.agent || data?.data?.agent || data?.data || null;
    if (!agent) {
      return null;
    }
    return agent;
  } catch (err) {
    console.error('Error in getMetadata:', err);
    return null;
  }
}

export default getMetadata;
