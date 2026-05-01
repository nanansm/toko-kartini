import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages
  transpilePackages: ['@kartini/db', '@kartini/auth', '@kartini/ui', '@kartini/sheets'],
  // typedRoutes disabled — too strict for dynamic segments at this stage
  output: 'standalone',
};

export default config;
