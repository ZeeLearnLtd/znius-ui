/** @type {import('next').NextConfig} */
const API_ORIGIN = 'https://kubapi.zeelearn.com';
const API_BASE   = '/V1/commonapieml/api/Zniusorder';
// const API_ORIGIN = 'http://localhost:3001';
// const API_BASE   = '/api/Zniusorder';
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: '/api-proxy',
  },
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${API_ORIGIN}${API_BASE}/:path*`,
      },
    ];
  },
};

export default nextConfig;
