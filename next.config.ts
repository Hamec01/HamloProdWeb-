import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / server-only modules that must not be bundled for the client or Edge.
  serverExternalPackages: ["argon2", "@prisma/client"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "usc1.contabostorage.com",
        pathname: "/e83fedb37f3543d0bc6c23caf78439e5:hamloprod-public/**",
      },
    ],
  },
};

export default nextConfig;
