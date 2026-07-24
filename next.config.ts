import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma's generated client out of the bundler. Next 16's Turbopack
  // build otherwise externalises `@prisma/client` under a content-hashed
  // module name (e.g. `@prisma/client-<hash>`) that the runtime can't resolve,
  // so every DB call in `next start` throws "Cannot find module".
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "prisma",
    "pdf-parse",
  ],

  // When the app is served through the litng cloudspaces / Codespaces HTTPS
  // proxy, Next 16 treats requests to /_next/* dev resources as cross-origin and
  // blocks them by default — which stops the client bundle from hydrating, so
  // forms fall back to a native submit and the page just reloads. Whitelist the
  // preview host(s) so the dev client works through the proxy.
  allowedDevOrigins: [
    "*.cloudspaces.litng.ai",
    "*.litng.ai",
    "3000-01kwxbvhqx8mmgg73bd8xxhggf.cloudspaces.litng.ai",
    "3200-01kwxbvhqx8mmgg73bd8xxhggf.cloudspaces.litng.ai",
  ],
};

export default nextConfig;
