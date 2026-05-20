import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export',  // 👈 ОБЯЗАТЕЛЬНО закомментируй эту строку!
  images: { 
    unoptimized: true 
  },
};

export default nextConfig;