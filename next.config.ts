import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone server output for a small production Docker image.
  output: 'standalone',
  // Security headers are also enforced at the Caddy edge (defence in depth);
  // these apply when the app is hit directly.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
