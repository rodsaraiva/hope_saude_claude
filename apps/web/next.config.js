/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint é validado separadamente em CI (.github/workflows/ci.yml).
  // Bloquear o build de produção por warnings de a11y herdados de código
  // legado seria ruído — corrigir esses warnings é objeto de uma sprint
  // dedicada de a11y.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
