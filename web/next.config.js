/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Enable static export for S3 hosting
  trailingSlash: true, // Ensure proper routing for S3
  images: {
    unoptimized: true, // Disable image optimization for static export
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Note: rewrites don't work with static export, API calls will need to be direct
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/:path*',
  //       destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`,
  //     },
  //   ];
  // },
};

module.exports = nextConfig; 