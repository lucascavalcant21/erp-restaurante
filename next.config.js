/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://localhost:3001/api/:path*"
            : "/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
