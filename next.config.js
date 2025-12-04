const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  swSrc: 'public/sw-custom.js',
  sw: 'sw.js',
  // Note: runtimeCaching is not allowed when using swSrc
  // Caching is handled in the custom service worker
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  // Skip build-time static generation for pages that need dynamic rendering
  output: 'standalone',
  // Ensure dynamic routes are not statically generated
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Suppress deprecation warnings from dependencies
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);



