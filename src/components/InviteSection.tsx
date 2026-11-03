import { useState } from 'react'
import { Link2 } from 'lucide-react'

type Props = {
  inviteLink: string | null
  groupName: string
  inviterName: string
  isOwner: boolean
  onGenerate: () => void
  onRevoke: () => void
  isPending: boolean
  isRevoking: boolean
  expiresAt?: string | null
  usesCount?: number
  maxUses?: number | null
}

export default function InviteSection({ inviteLink, groupName, inviterName, isOwner, onGenerate, onRevoke, isPending, isRevoking, expiresAt, usesCount = 0, maxUses }: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShare() {
    if (!inviteLink) return
    const text = `${inviterName} te invitó a “${groupName}” en JuntApp.`
    if (navigator.share) {
      await navigator.share({ title: `Invitación a ${groupName}`, text, url: inviteLink })
    } else {
      await navigator.clipboard.writeText(`${text}\n\n${inviteLink}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const whatsappLink = inviteLink
    ? 'https://wa.me/?text=' + encodeURIComponent(
        '👋 ' + inviterName + ' te invitó a "' + groupName + '" en JuntApp.\n\nÚnete aquí:\n' + inviteLink
      )
    : null

  return (
    <div className="invite-section">
      {inviteLink ? (
        <>
          <div className="invite-row">
            <div>
              <strong><span className="invite-icon"><Link2 size={16} /></span> Invita a tu gente</strong>
              <p>
                {expiresAt ? `Vence ${new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' }).format(new Date(expiresAt))}` : 'Enlace activo'}
                {maxUses ? ` · ${usesCount}/${maxUses} usos` : ''}
              </p>
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
          <button className="invite-share" onClick={() => void handleShare()}>Compartir por otra app</button>
          <button className="invite-revoke" onClick={onRevoke} disabled={isRevoking}>
            {isRevoking ? 'Revocando…' : 'Revocar enlace'}
          </button>
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
