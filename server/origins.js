// Exact browser origins only. Local aliases are interchangeable during development.
export function allowedOrigins(config) {
  const origins = new Set([config.origin, ...(config.additionalOrigins ?? [])])
  if (!config.secure) {
    for (const origin of [...origins]) {
      const url = new URL(origin)
      if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) continue
      for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
        url.hostname = hostname
        origins.add(url.origin)
      }
    }
  }
  return origins
}
