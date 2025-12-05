const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  swSrc: 'public/sw-custom.js',
  sw: 'sw.js',
  // Disable precaching completely - we only need push notifications
  publicExcludes: ['**/*'], // Exclude all files from precaching
  buildExcludes: [/.*/], // Exclude everything from build manifest
  // Note: workboxOptions is not supported when using swSrc
  // We don't reference __WB_MANIFEST in sw-custom.js, so no precaching code will be injected
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
  // Security headers for PWA
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        // Service worker specific headers
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://storage.googleapis.com;",
          },
        ],
      },
    ];
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



