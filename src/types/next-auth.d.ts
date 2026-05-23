import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    // accessToken is deliberately absent — it lives only in the server-side
    // JWT (httpOnly cookie). Use getGitHubAccessToken(req) in API routes.
    githubId?: string;
    githubLogin?: string;
    gitlabToken?: string;
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    githubId?: string;
    githubLogin?: string;
    gitlabToken?: string;
  }
}
