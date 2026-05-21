import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  isMetricsCacheBypassed,
  withMetricsCache,
} from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

const GITHUB_API = "https://api.github.com";

function dateDiffDays(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type CompareResult = {
  username: string;
  streak: number;
  commits30d: number;
  topLanguage: string;
  prs: number;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return Response.json({ error: "Username required" }, { status: 400 });
  }

  if (username === "me") {
    username = session.githubLogin as string;
  }

  // Verify user exists — always fresh, not cached (existence can change)
  const userRes = await fetch(`${GITHUB_API}/users/${username}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });

  if (!userRes.ok) {
    if (userRes.status === 404) return Response.json({ error: "User not found" }, { status: 404 });
    return Response.json({ error: "GitHub API error or User is private" }, { status: 502 });
  }

  // Cache key scoped to the requesting user's githubId. Next.js's built-in
  // fetch cache keys by URL only and does not include Authorization headers,
  // which would allow one user's private repository data to be served to a
  // different user who queries the same target username. Using withMetricsCache
  // with a per-user key eliminates that cross-user data exposure.
  const bypass = isMetricsCacheBypassed(req);
  const cacheKey = `metrics:${session.githubId}:compare:${username}`;

  const result = await withMetricsCache<CompareResult>(
    { bypass, key: cacheKey, ttlSeconds: 3600 },
    async () => {
      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      const since90Str = since90.toISOString().slice(0, 10);

      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const since30Str = since30.toISOString().slice(0, 10);

      const commitsRes = await fetch(
        `${GITHUB_API}/search/commits?q=author:${username}+author-date:>=${since90Str}&per_page=100&sort=author-date&order=desc`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        }
      );

      let streak = 0;
      let commits30d = 0;
      let topLanguage = "Unknown";

      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        const items = commitsData.items || [];

        const daySet: Record<string, true> = {};
        for (const item of items) {
          const dateStr = item.commit.author.date.slice(0, 10);
          daySet[dateStr] = true;
          if (dateStr >= since30Str) {
            commits30d++;
          }
        }
        const commitDays = Object.keys(daySet).sort();

        if (commitDays.length > 0) {
          let currentRun = 1;
          const runs: { end: string; length: number }[] = [];
          for (let i = 1; i < commitDays.length; i++) {
            if (dateDiffDays(commitDays[i - 1], commitDays[i]) === 1) {
              currentRun++;
            } else {
              runs.push({ end: commitDays[i - 1], length: currentRun });
              currentRun = 1;
            }
          }
          runs.push({ end: commitDays[commitDays.length - 1], length: currentRun });

          const today = toDateStr(new Date());
          const yesterday = toDateStr(new Date(Date.now() - 86400000));
          const lastRun = runs[runs.length - 1];
          streak = (lastRun.end === today || lastRun.end === yesterday) ? lastRun.length : 0;
        }
      }

      const reposRes = await fetch(`${GITHUB_API}/users/${username}/repos?per_page=100&sort=pushed`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });

      if (reposRes.ok) {
        const reposData = await reposRes.json();
        const langCounts: Record<string, number> = {};
        for (const repo of reposData) {
          if (repo.language) {
            langCounts[repo.language] = (langCounts[repo.language] || 0) + 1;
          }
        }
        const sortedLangs = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
        if (sortedLangs.length > 0) topLanguage = sortedLangs[0][0];
      }

      const prsRes = await fetch(
        `${GITHUB_API}/search/issues?q=type:pr+author:${username}&per_page=1`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          cache: "no-store",
        }
      );
      let prs = 0;
      if (prsRes.ok) {
        const prsData = await prsRes.json();
        prs = prsData.total_count || 0;
      }

      return { username, streak, commits30d, topLanguage, prs };
    }
  );

  return Response.json(result);
}
