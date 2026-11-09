/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // pptxgenjs referencia módulos do Node que não existem no navegador: tira o "node:" e ignora
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (r) => { r.request = r.request.replace(/^node:/, ""); }));
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false, os: false, path: false, "image-size": false };
    return config;
  },
};
