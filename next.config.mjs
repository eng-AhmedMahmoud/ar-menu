/** @type {import('next').NextConfig} */
const nextConfig = {
  // .usdz is not in Next's default static mime table; Quick Look refuses the
  // file unless the Content-Type is exact.
  async headers() {
    return [
      {
        source: '/models/:path*.usdz',
        headers: [{ key: 'Content-Type', value: 'model/vnd.usdz+zip' }],
      },
      {
        source: '/models/:path*.glb',
        headers: [{ key: 'Content-Type', value: 'model/gltf-binary' }],
      },
    ]
  },
}

export default nextConfig
