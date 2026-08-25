import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/accounts",
        destination: "/creators",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
