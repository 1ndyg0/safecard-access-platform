import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The queue was renamed. Bookmarks and old links keep working.
      { source: "/admin/submissions", destination: "/admin/applications", permanent: true },
    ];
  },
};

export default nextConfig;
