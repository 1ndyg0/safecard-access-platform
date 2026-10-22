import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The document route reads PDFs with fs at request time, which static
  // tracing cannot see. Ship them with that route.
  outputFileTracingIncludes: {
    "/api/documents/*": ["./content/documents/*.pdf"],
  },
  async redirects() {
    return [
      // The queue was renamed. Bookmarks and old links keep working.
      { source: "/admin/submissions", destination: "/admin/applications", permanent: true },
    ];
  },
};

export default nextConfig;
