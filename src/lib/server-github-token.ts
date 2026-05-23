import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * Retrieves the GitHub OAuth access token from the server-side JWT (httpOnly cookie).
 * The token is never exposed to the browser — call this only in server-side API routes.
 */
export async function getGitHubAccessToken(
  req: NextRequest
): Promise<string | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return typeof token?.accessToken === "string" ? token.accessToken : null;
}
