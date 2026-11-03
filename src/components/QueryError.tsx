import { toUserMessage } from '../lib/errors'

export default function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className='error-state' role='alert'>
      <strong>No pudimos cargar esta información</strong>
      <span>{toUserMessage(error, 'El servidor no respondió correctamente.')}</span>
      <button type='button' onClick={onRetry}>Reintentar</button>
    </div>
  )
}
