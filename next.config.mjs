/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    return [
      { source: "/:path*", headers: base },
      // o service worker precisa ser sempre a versão mais nova
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      // páginas dos links secretos (decisões e anjo do quarto): nunca guardar em cache
      { source: "/q/:token", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/r/:token", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  webpack: (config, { webpack }) => {
    // pptxgenjs referencia módulos do Node que não existem no navegador: tira o "node:" e ignora
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (r) => { r.request = r.request.replace(/^node:/, ""); }));
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false, os: false, path: false, "image-size": false };
    return config;
  },
};
