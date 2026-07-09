import type { NextConfig } from "next";

// The backend API has no CORS layer (and shouldn't need one for us):
// the frontend calls same-origin /api/* and Next proxies it across.
// Override the origin per environment when the backend isn't local.
const API_ORIGIN = process.env.BACKEND_API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
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
