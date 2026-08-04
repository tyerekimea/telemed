/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the build output can be wrapped by Capacitor
  output: "export",
  images: { unoptimized: true },
};

module.exports = nextConfig;
