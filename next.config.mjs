/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deshabilitar source maps en producción (seguridad)
  productionBrowserSourceMaps: false,

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' https://*.public.blob.vercel-storage.com; connect-src 'self' https://api.openai.com https://*.firecrawl.dev https://*.vercel-insights.com https://www.facebook.com https://connect.facebook.net; frame-src 'self' https://www.loom.com; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
