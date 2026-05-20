import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export',  // 👈 ОБЯЗАТЕЛЬНО закомментируй!
  images: { 
    unoptimized: true 
  },
};

export default nextConfig;