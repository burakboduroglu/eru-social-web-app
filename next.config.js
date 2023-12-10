/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/eru-social-web-app",
  assetPrefix: "/eru-social-web-app/",
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ["mongoose"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: [
      "img.clerk.com",
      "images.clerk.dev",
      "uploadthing.com",
      "placehold.co",
      "utfs.io",
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        destination: "/app/:path*",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
