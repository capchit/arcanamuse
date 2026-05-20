import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export',  // 👈 ЗАКОММЕНТИРУЙ ЭТУ СТРОКУ
  images: { 
    unoptimized: true 
  },
};

export default nextConfig;