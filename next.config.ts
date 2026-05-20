import type { NextConfig } from "next";

// @ts-ignore
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 👇 Добавьте эту строку, чтобы "успокоить" Turbopack
  turbopack: {}, 
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig);