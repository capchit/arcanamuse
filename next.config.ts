import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export',
  images: { unoptimized: true },
  
};
// 👇 Добавь эту строку для сброса кэша:
  eslint: { ignoreDuringBuilds: true }
export default nextConfig;