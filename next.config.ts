import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / server-only modules that must not be bundled for the client or Edge.
  serverExternalPackages: ["argon2", "@prisma/client"],
};

export default nextConfig;
