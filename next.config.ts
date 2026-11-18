import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./LICENSEMAKER/assets/default_signature.png"],
    "/api/admin/licenses": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/admin/licenses/**": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/orders/*/redeem": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/orders/*/payment-status": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/contracts/**": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/stripe/webhook": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/lava/webhook": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/payments/create": ["./node_modules/@sparticuz/chromium/**/*"],
  },
  // Native / server-only modules that must not be bundled for the client or Edge.
  serverExternalPackages: ["argon2", "@prisma/client", "@sparticuz/chromium", "nunjucks"],
  images: {
    localPatterns: [{ pathname: "/api/beats/*/cover" }, { pathname: "/**", search: "" }],
    qualities: [60, 75],
    minimumCacheTTL: 86400,
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
