// Railway GraphQL API spike for per-project usage.
// Returns null on any failure (auth missing, schema changed, network).
// If this returns null, the budget tracker shows manual-entry mode for Railway.

export async function fetchRailwayMtd(): Promise<number | null> {
  const token = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (!token || !projectId) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const graphql = `
    query($projectId: String!, $start: DateTime!, $end: DateTime!) {
      project(id: $projectId) {
        usage(measurements: [CPU_USAGE, MEMORY_USAGE, NETWORK_TX_GB], startDate: $start, endDate: $end) {
          totalUsd
        }
      }
    }
  `;

  try {
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: graphql,
        variables: { projectId, start: startOfMonth, end: now.toISOString() },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const total = json?.data?.project?.usage?.totalUsd;
    return typeof total === 'number' ? total : null;
  } catch (err) {
    console.error('fetchRailwayMtd failed:', err);
    return null;
  }
}
