import { View, Text, StyleSheet } from 'react-native'

type ProfileData = {
  id?: string
  full_name?: string | null
  avatar_url?: string | null
}

type User = {
  user_id: string
  profiles?: ProfileData | ProfileData[] | null
}

type Props = {
  going: User[]
  maybe: User[]
  notGoing: User[]
  pending: User[]
}

function getName(profiles: ProfileData | ProfileData[] | null | undefined): string | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0]?.full_name || null
  return profiles.full_name || null
}

function getInitials(profiles: ProfileData | ProfileData[] | null | undefined): string {
  const name = getName(profiles)
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function PillGroup({ label, users, labelColor, bgColor, dim }: { label: string; users: User[]; labelColor: string; bgColor: string; dim?: boolean }) {
  if (users.length === 0) return null
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: labelColor }]}>{label} ({users.length})</Text>
      <View style={styles.pillRow}>
        {users.map((u) => (
          <View key={u.user_id} style={[styles.pill, { backgroundColor: bgColor }, dim && { opacity: 0.5 }]}>
            <View style={styles.pillAvatar}>
              <Text style={styles.pillAvatarText}>{getInitials(u.profiles)}</Text>
            </View>
            <Text style={styles.pillName}>{getName(u.profiles) || 'Sin nombre'}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function AttendancePills({ going, maybe, notGoing, pending }: Props) {
  return (
    <View style={styles.container}>
      <PillGroup label="Van" users={going} labelColor="#166534" bgColor="#f0fdf4" />
      <PillGroup label="Tal vez" users={maybe} labelColor="#b45309" bgColor="#fffbeb" />
      <PillGroup label="No van" users={notGoing} labelColor="#991b1b" bgColor="#fef2f2" />
      <PillGroup label="Sin responder" users={pending} labelColor="#69746d" bgColor="#f9fafb" dim />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    marginTop: 20,
  },
  group: {
    marginBottom: 0,
  },
  groupLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingRight: 10,
    paddingLeft: 4,
    borderRadius: 20,
  },
  pillAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e8efdf',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillAvatarText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 8,
    color: '#28533a',
  },
  pillName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#18261f',
  },
})
