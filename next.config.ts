
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // This is required to allow the Firebase Studio development environment to connect to the Next.js dev server.
    allowedDevOrigins: [
      "*.cluster-44kx2eiocbhe2tyk3zoyo3ryuo.cloudworkstations.dev",
    ]
  },
  serverActions: {
    bodySizeLimit: '10mb',
  },
};

export default nextConfig;
