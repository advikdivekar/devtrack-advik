import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { fetchIssuesMetrics } from "@/lib/github";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { getGitHubAccessToken } from "@/lib/server-github-token";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = await getGitHubAccessToken(req);
  if (!accessToken || !session?.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(session.githubId ?? session.githubLogin, "issues");

  try {
    const metrics = await withMetricsCache(
      { bypass, key, ttlSeconds: METRICS_CACHE_TTL_SECONDS.issues },
      () => fetchIssuesMetrics(accessToken)
    );

    return Response.json(metrics);
  } catch {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
