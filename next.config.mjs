/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export served by nginx on the Devya VPS (https://ar-menu.devya.dev,
  // scripts/deploy-vps.sh). nginx sets the exact model Content-Types Quick Look
  // and model-viewer need (.usdz, .glb), see deploy/nginx/ar-menu.conf.
  output: 'export',
}

export default nextConfig
