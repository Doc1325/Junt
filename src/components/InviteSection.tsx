import { useState } from 'react'
import { Link2 } from 'lucide-react'

type Props = {
  inviteLink: string | null
  groupName: string
  isOwner: boolean
  onGenerate: () => void
  isPending: boolean
}

export default function InviteSection({ inviteLink, groupName, isOwner, onGenerate, isPending }: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const whatsappLink = inviteLink
    ? 'https://wa.me/?text=' + encodeURIComponent(
        '👋 Te invitaron a "' + groupName + '" en JuntApp\n\nÚnete con este enlace:\n' + inviteLink
      )
    : null

  return (
    <div className="invite-section">
      {inviteLink ? (
        <>
          <div className="invite-row">
            <div>
              <strong><span className="invite-icon"><Link2 size={16} /></span> Invita a tu gente</strong>
              <p>Enlace listo para compartir</p>
            </div>
            <button className="invite-copy-btn" onClick={handleCopy}>
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <a
            href={whatsappLink!}
            target="_blank"
            rel="noopener"
            className="invite-whatsapp"
          >
            Compartir por WhatsApp
          </a>
        </>
      ) : isOwner ? (
        <>
          <div className="invite-row">
            <div>
              <strong><span className="invite-icon"><Link2 size={16} /></span> Invita a tu gente</strong>
              <p>Genera un enlace para invitar miembros.</p>
            </div>
            <button className="invite-copy-btn" onClick={onGenerate} disabled={isPending}>
              {isPending ? 'Generando…' : 'Generar'}
            </button>
          </div>
        </>
      ) : (
        <div className="invite-row">
          <div>
            <strong><span className="invite-icon"><Link2 size={16} /></span> Invita a tu gente</strong>
            <p>Pide al creador que genere un enlace.</p>
          </div>
        </div>
      )}
    </div>
  )
}
