import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // Dev-serveren nås via Cloudflare Tunnel på dette værtsnavn (kun hostname, uden skema og port).
  allowedDevOrigins: ['aula-dev.aaensoftware.com'],
};

export default config;
