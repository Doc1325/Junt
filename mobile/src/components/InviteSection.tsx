import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator, Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'

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

  async function handleCopy() {
    if (!inviteLink) return
    await Clipboard.setStringAsync(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareWhatsApp() {
    if (!inviteLink) return
    const text = '👋 ' + inviterName + ' te invitó a "' + groupName + '" en JuntApp.\n\nÚnete aquí:\n' + inviteLink
    Linking.openURL('https://wa.me/?text=' + encodeURIComponent(text))
  }

  async function shareInvite() {
    if (!inviteLink) return
    await Share.share({ message: `👋 ${inviterName} te invitó a "${groupName}" en JuntApp.\n\nÚnete aquí:\n${inviteLink}` })
  }

  return (
    <View style={styles.section}>
      {inviteLink ? (
        <>
          <View style={styles.row}>
            <View style={styles.col}>
              <View style={styles.titleRow}>
                <View style={styles.iconWrap}>
                  <Ionicons name="link" size={16} color="#28533a" />
                </View>
                <Text style={styles.strong}>Invita a tu gente</Text>
              </View>
              <Text style={styles.p}>
                {expiresAt ? `Vence ${new Date(expiresAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}` : 'Enlace activo'}
                {maxUses ? ` · ${usesCount}/${maxUses} usos` : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Text style={styles.copyBtnText}>{copied ? 'Copiado' : 'Copiar'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.whatsapp} onPress={shareWhatsApp}>
            <Text style={styles.whatsappText}>Compartir por WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.share} onPress={() => void shareInvite()}>
            <Text style={styles.shareText}>Compartir por otra app</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.revoke} onPress={onRevoke} disabled={isRevoking}>
            <Text style={styles.revokeText}>{isRevoking ? 'Revocando…' : 'Revocar enlace'}</Text>
          </TouchableOpacity>
        </>
      ) : isOwner ? (
        <View style={styles.row}>
          <View style={styles.col}>
            <View style={styles.titleRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="link" size={16} color="#28533a" />
              </View>
              <Text style={styles.strong}>Invita a tu gente</Text>
            </View>
            <Text style={styles.p}>Genera un enlace para invitar miembros.</Text>
          </View>
          <TouchableOpacity style={styles.copyBtn} onPress={onGenerate} disabled={isPending}>
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.copyBtnText}>Generar</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.col}>
            <View style={styles.titleRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="link" size={16} color="#28533a" />
              </View>
              <Text style={styles.strong}>Invita a tu gente</Text>
            </View>
            <Text style={styles.p}>Pide al creador que genere un enlace.</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#d8eabb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  col: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 6,
    lineHeight: 0,
  },
  strong: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: '#18261f',
  },
  p: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#69746d',
    marginTop: 2,
  },
  copyBtn: {
    backgroundColor: '#28533a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 7,
    minWidth: 72,
    alignItems: 'center',
  },
  copyBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: '#fff',
  },
  whatsapp: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#25D366',
    alignItems: 'center',
  },
  whatsappText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: '#fff',
  },
  share: { marginTop: 8, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#28533a', alignItems: 'center' },
  shareText: { color: '#28533a', fontFamily: 'DMSans_700Bold', fontSize: 12 },
  revoke: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  revokeText: { color: '#8f2f24', fontFamily: 'DMSans_700Bold', fontSize: 12 },
})
