/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma', 'puppeteer', 'playwright'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('puppeteer', 'playwright', '@playwright/test');
    }
    return config;
  },
};

module.exports = nextConfig;
