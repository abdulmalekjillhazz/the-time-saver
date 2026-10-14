const apiOrigin = (() => {
  const candidates = [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.API_URL,
    process.env.NODE_ENV === 'production' ? 'https://server-s3yn.vercel.app' : 'http://localhost:5000',
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const origin = new URL(candidate).origin;
      if (process.env.NODE_ENV === 'production' && origin.includes('localhost')) continue;
      return origin;
    } catch {
      // try next
    }
  }
  return process.env.NODE_ENV === 'production' ? 'https://server-s3yn.vercel.app' : 'http://localhost:5000';
})();

// Script-src keeps 'unsafe-inline' because Next.js 14 inlines its hydration scripts. Replace it with nonces later.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/",
  "img-src 'self' data: https://res.cloudinary.com",
  "media-src 'self' data: blob: https://res.cloudinary.com",
  `connect-src 'self' ${apiOrigin} https://api.cloudinary.com https://res.cloudinary.com https://accounts.google.com/gsi/`,
  'frame-src https://accounts.google.com/gsi/',
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@smart-routine/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/fnxzbafx/**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
