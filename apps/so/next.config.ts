import path from 'node:path';
import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

const config: NextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages
  transpilePackages: ['@kartini/ui', '@kartini/sheets'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default config;
