const nextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  allowedDevOrigins: ["192.168.0.102"],
  cacheComponents: true,
};

export default nextConfig;