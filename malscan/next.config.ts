import type { NextConfig } from "next";

// Capacitor packages this app as static HTML/JS with no Next.js server, so
// rewrites (which need a server) can't run — see lib/config.ts for how API
// calls are pointed at the backend directly in that build instead.
const isCapacitorBuild = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = isCapacitorBuild
  ? {
      output: "export",
      images: { unoptimized: true },
    }
  : {
      async rewrites() {
        return [
          {
            source: "/api/:path*",
            destination: "http://127.0.0.1:8000/:path*", // Proxy to FastAPI Backend
          },
        ];
      },
    };

export default nextConfig;
