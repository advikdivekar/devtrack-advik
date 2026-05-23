import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { fetchIssuesMetrics } from "@/lib/github";
import { getGitHubAccessToken } from "@/lib/server-github-token";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = await getGitHubAccessToken(req);
  if (!session?.githubId || !accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const metrics = await fetchIssuesMetrics(accessToken);
    return Response.json(metrics);
  } catch {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
