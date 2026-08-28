import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimizaciones de memoria
  onDemandEntries: {
    maxInactiveAge: 15 * 1000, // 15 segundos
    pagesBufferLength: 5,
  },

  // Deshabilitar source maps en desarrollo para ahorrar memoria
  productionBrowserSourceMaps: false,

  // Limitar concurrent compilaciones
  experimental: {
    memoryBasedWorkersCount: true,
  },
};

export default nextConfig;
