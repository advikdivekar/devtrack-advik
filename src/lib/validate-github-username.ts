/**
 * Validates a GitHub username against GitHub's official format rules:
 * 1–39 characters, alphanumeric and hyphens only, cannot start or end with a hyphen.
 *
 * Rejecting special characters (+, /, ?, &, etc.) prevents injection of additional
 * GitHub search qualifiers or URL path segments into server-side GitHub API calls.
 */
export function isValidGitHubUsername(username: unknown): username is string {
  if (typeof username !== "string") return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username);
}
