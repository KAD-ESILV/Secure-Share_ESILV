/**
 * Centralized Express error handler.
 * Ensures consistent JSON error shape across the API.
 */
export function errorHandler (err, _req, res, _next) {
  const status = err?.status ?? 500
  const message = err?.message ?? 'Internal Server Error'
  res.status(status).json({ error: true, message })
}
