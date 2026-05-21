import { type NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { supabaseAdmin } from "./supabase";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const SESSION_UPDATE_AGE = 24 * 60 * 60;
const useSecureCookies = process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
      authorization: {
        params: { scope: "read:user user:email repo" },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  cookies: {
    sessionToken: {
      name: useSecureCookies
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: SESSION_MAX_AGE,
      },
    },
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "github" && profile) {
        const p = profile as { id: number; login: string };
        await supabaseAdmin.from("users").upsert(
          {
            github_id: String(p.id),
            github_login: p.login,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "github_id" }
        );
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.accessTokenValidatedAt = Date.now();
      }
      if (profile) {
        const p = profile as { id: number; login: string };
        token.githubId = String(p.id);
        token.githubLogin = p.login;
      }

      const validatedAt =
        typeof token.accessTokenValidatedAt === "number"
          ? token.accessTokenValidatedAt
          : 0;
      const VALIDATION_INTERVAL = 24 * 60 * 60 * 1000;

      if (token.accessToken && Date.now() - validatedAt > VALIDATION_INTERVAL) {
        try {
          const res = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${token.accessToken}` },
            cache: "no-store",
          });
          if (res.status === 401) {
            token.error = "TokenRevoked";
          } else if (res.ok) {
            token.accessTokenValidatedAt = Date.now();
            delete token.error;
          }
        } catch {
          // Network error: preserve session, do not mark token as invalid
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (typeof token.accessToken === "string")
        session.accessToken = token.accessToken;
      if (typeof token.githubId === "string")
        session.githubId = token.githubId;
      if (typeof token.githubLogin === "string")
        session.githubLogin = token.githubLogin;
      if (typeof token.error === "string")
        session.error = token.error;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
