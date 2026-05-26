import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { isMetricsCacheBypassed } from "@/lib/metrics-cache";
import { resolveAppUser } from "@/lib/resolve-user";
import { syncGitHubAchievementsForUser } from "@/lib/github-achievements";
import { getGitHubAccessToken } from "@/lib/server-github-token";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = await getGitHubAccessToken(req);

  if (!accessToken || !session?.githubId || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncGitHubAchievementsForUser({
    userId: user.id,
    githubLogin: session.githubLogin,
    token: accessToken,
    force: isMetricsCacheBypassed(req),
  });

  return Response.json(result);
}
