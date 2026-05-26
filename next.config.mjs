/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // ── Console removal ───────────────────────────────────────────────
  // IMPORTANT: Do NOT enable removeConsole for server bundles.
  // The trade engine, startup coordinator, migrations, live-stage, and
  // instrumentation all emit critical [v0] trace logs via console.log.
  // Stripping these from the server bundle makes production completely
  // blind to startup, migration, order-placement, and close events.
  //
  // removeConsole is intentionally left disabled (false) in all
  // environments so diagnostics are always available in production logs
  // (Vercel Functions tab, log drains, etc.).
  compiler: {
    removeConsole: false,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
  webpack: (config, { isServer, nextRuntime, webpack }) => {
    config.resolve = config.resolve || {}
    config.plugins = config.plugins || []

    // Strip the `node:` URI scheme so Webpack 5 can resolve Node built-ins
    // on both server and edge targets without UnhandledSchemeError.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "")
      }),
    )

    // Browser bundle: alias Node built-ins to empty stubs.
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        crypto: false,
        stream: false,
        buffer: false,
      }
    }

    // Edge runtime: stub every Node built-in that server-side libs import.
    // The instrumentation.ts runtime guard ensures stubs are never executed.
    if (nextRuntime === "edge") {
      const nodeBuiltinsToStub = [
        "crypto",
        "fs",
        "fs/promises",
        "path",
        "stream",
        "buffer",
        "events",
        "timers",
        "timers/promises",
        "os",
        "url",
        "util",
        "zlib",
      ]
      const stubAliases = {}
      for (const name of nodeBuiltinsToStub) {
        stubAliases[name] = false
        stubAliases[`node:${name}`] = false
      }
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        ...stubAliases,
      }
    }

    return config
  },
}

export default nextConfig
