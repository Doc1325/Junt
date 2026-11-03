type ErrorLike = { code?: string; message?: string; name?: string; status?: number }

function asErrorLike(error: unknown): ErrorLike {
  if (typeof error === 'object' && error !== null) return error as ErrorLike
  return { message: String(error ?? '') }
}

export function isRetryableError(error: unknown) {
  const value = asErrorLike(error)
  const message = value.message?.toLowerCase() ?? ''
  return value.name === 'TypeError'
    || value.status === 408
    || value.status === 429
    || (typeof value.status === 'number' && value.status >= 500)
    || ['PGRST000', 'PGRST001', 'PGRST002'].includes(value.code ?? '')
    || ['failed to fetch', 'network request failed', 'load failed', 'timeout'].some((part) => message.includes(part))
}

export function toUserMessage(error: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.') {
  const value = asErrorLike(error)
  const message = value.message?.toLowerCase() ?? ''
  if (isRetryableError(error)) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
  if (value.code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'No tienes permiso para realizar esta acción.'
  }
  if (value.code === '23505') return 'Ese registro ya existe.'
  if (value.code === 'PGRST116') return 'No encontramos la información solicitada.'
  if (message.includes('invite_revoked')) return 'El dueño revocó esta invitación.'
  if (message.includes('invite_expired') || message.includes('invalid or expired invite')) return 'Esta invitación venció.'
  if (message.includes('invite_limit_reached')) return 'Esta invitación alcanzó su límite de personas.'
  if (message.includes('invite_invalid')) return 'Este enlace de invitación no es válido.'
  if (message.includes('not a member')) return 'Ya no perteneces a este grupo.'
  if (message.includes('only the plan creator')) return 'Solo quien creó el plan puede hacer este cambio.'
  if (message.includes('authentication') || value.status === 401) return 'Tu sesión expiró. Inicia sesión de nuevo.'
  return fallback
}
