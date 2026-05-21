/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

  async headers() {
    // Content-Security-Policy notes:
    // - script-src requires 'unsafe-inline' for the theme-init inline script
    //   in layout.tsx (dangerouslySetInnerHTML). Removing it would require
    //   nonce-based CSP configuration.
    // - style-src requires 'unsafe-inline' for Tailwind's runtime style
    //   injection and Next.js component styles.
    // - connect-src uses *.supabase.co wildcard because the project URL is
    //   set via NEXT_PUBLIC_SUPABASE_URL at deploy time.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' avatars.githubusercontent.com data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' api.github.com https://*.supabase.co",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
