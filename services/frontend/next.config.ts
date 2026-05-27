import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // For Docker
  // Lint is non-blocking for builds (run separately); ESLint errors must not fail the prod/staging Docker build.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
