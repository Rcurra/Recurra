import type { NextConfig } from "next";

// The backend API has no CORS layer (and shouldn't need one for us):
// the frontend calls same-origin /api/* and Next proxies it across.
// Override the origin per environment when the backend isn't local.
const API_ORIGIN = process.env.BACKEND_API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // @particle-network/universal-account-sdk pulls in @coral-xyz/anchor
  // (Solana tooling) as a dependency, and runs a top-level `new Program(...)`
  // the instant the package is imported -- before we ever construct
  // anything ourselves. That code assumes Node's ambient `Buffer`/`process`
  // globals, which Turbopack (unlike older webpack setups) does NOT
  // auto-polyfill for the browser. Without this, importing lib/particle.ts
  // client-side throws "[void 0] is not a constructor" at module load.
  turbopack: {
    resolveAlias: {
      buffer: "buffer",
      process: "process/browser",
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
