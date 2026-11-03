import useOnlineStatus from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return <div className='offline-banner' role='status'>Sin conexión. Tus datos se reintentarán al volver a estar en línea.</div>
}

