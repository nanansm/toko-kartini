import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages
  transpilePackages: ['@kartini/db', '@kartini/auth', '@kartini/ui', '@kartini/sheets'],
  experimental: {
    typedRoutes: true,
  },
  output: 'standalone',
};

export default config;
