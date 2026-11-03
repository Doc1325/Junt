import { useEffect, useState } from 'react'
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { planTitleFor } from '../lib/recommendations'
import { useGroups } from '../lib/queries'
import type { RootStackParamList } from '../../App'
import { colors, fonts, radii } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>
type DetailRoute = RouteProp<RootStackParamList, 'EventDetail'>

export default function EventDetail() {
  const nav = useNavigation<Nav>()
  const route = useRoute<DetailRoute>()
  const insets = useSafeAreaInsets()
  const { kind, slug, groupId, item: itemJson } = route.params
  const { data: groups = [], isLoading: groupsLoading } = useGroups()
  const [selectedGroupId, setSelectedGroupId] = useState(groupId ?? '')
  const [prefill] = useState(() => {
    try {
      return itemJson ? (JSON.parse(itemJson) as Record<string, unknown>) : null
    } catch {
      return null
    }
  })

  const { data: item, isLoading } = useQuery({
    queryKey: ['event-detail', kind, slug],
    queryFn: async () => {
      if (prefill && String(prefill.slug ?? prefill.external_id) === slug) return prefill
      const table = kind === 'cine' ? 'movies' : 'events'
      const col = kind === 'cine' ? 'external_id' : 'slug'
      const { data, error } = await supabase.from(table).select('*').eq(col, slug).single()
      if (error) throw error
      return { kind, ...data } as Record<string, unknown>
    },
  })

  useEffect(() => {
    if (selectedGroupId || groups.length !== 1) return
    setSelectedGroupId(groups[0].id)
  }, [groups, selectedGroupId])

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.olive} />
      </View>
    )
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No encontramos este evento.</Text>
      </View>
    )
  }

  const isMovie = (item.kind as string) === 'cine' || kind === 'cine'
  const title = String(item.title ?? '')
  const image = item.image as string
  const category =
    (item.category as string) ?? ((item.genres as string[])?.join(', ') ?? '')
  const priceTag = String(item.price_tag ?? '')
  const price = ((item.price as string) ?? null) || priceTag
  const isGratis = priceTag === 'Gratis'
  const province = String(item.province ?? item.city ?? '')
  const venue = String(item.venue ?? '')
  const date = String(item.start_date ?? '')
  const hour = String(item.hour_start ?? '')
  const desc = String(item.description ?? item.synopsis ?? '')
  const source = String(item.source_url ?? '')

  function useForPlan() {
    if (!selectedGroupId) return
    const startDate = String(item!.start_date ?? '')
    const hourStart = String(item!.hour_start ?? '')
    const scheduledAt = startDate
      ? hourStart
        ? `${startDate}T${hourStart.slice(0, 5)}`
        : `${startDate}T19:00`
      : ''
    nav.navigate('NewPlan', {
      groupId: selectedGroupId,
      prefillTitle: planTitleFor({
        title,
        category: isMovie ? undefined : category,
        kind: isMovie ? 'cine' : 'evento',
      }),
      prefillDescription: source || desc,
      prefillScheduledAt: scheduledAt,
    })
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.media}>
          {image && image !== 'N/A' ? (
            <Image source={{ uri: image }} style={styles.mediaImage} resizeMode="contain" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>{isMovie ? '🎬' : '📍'}</Text>
            </View>
          )}
          <View style={styles.badgeLeft}>
            <Text style={styles.badgeText}>{category || (isMovie ? 'Cine' : 'Evento')}</Text>
          </View>
          <View style={[styles.badgeRight, isGratis && styles.badgeLime]}>
            <Text style={[styles.badgeText, isGratis && styles.badgeLimeText]}>{price || 'De pago'}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <View style={styles.metaIcon}><Text>📍</Text></View>
              <Text style={styles.metaText}>
                <Text style={styles.metaStrong}>{province}</Text>
                {venue ? ` · ${venue}` : ''}
              </Text>
            </View>
            {!!date && (
              <View style={styles.metaRow}>
                <View style={styles.metaIcon}><Text>📅</Text></View>
                <Text style={[styles.metaText, styles.metaStrong]}>
                  {date}{hour ? ` · ${hour.slice(0, 5)}` : ''}
                </Text>
              </View>
            )}
            {!!category && (
              <View style={styles.metaRow}>
                <View style={styles.metaIcon}><Text>✨</Text></View>
                <Text style={styles.metaText}>{category}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <View style={styles.metaIcon}><Text>💸</Text></View>
              <Text style={[styles.metaText, styles.metaStrong, isGratis && styles.freeText]}>{price}</Text>
            </View>
          </View>

          {!!desc && (
            <View style={styles.desc}>
              <Text style={styles.eyebrow}>SOBRE EL EVENTO</Text>
              <Text style={styles.descText}>{desc}</Text>
            </View>
          )}

          <View style={styles.groupPicker}>
            <View style={styles.groupPickerCopy}>
              <Text style={styles.eyebrow}>¿CON QUÉ GRUPO?</Text>
              <Text style={styles.groupPickerHint}>Selecciona dónde quieres proponer este evento.</Text>
            </View>
            {groupsLoading ? (
              <ActivityIndicator color={colors.olive} />
            ) : groups.length > 0 ? (
              <View style={styles.groupOptions} accessibilityRole="radiogroup">
                {groups.map((group) => {
                  const selected = selectedGroupId === group.id
                  return (
                    <TouchableOpacity
                      key={group.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setSelectedGroupId(group.id)}
                      style={[styles.groupOption, selected && styles.groupOptionSelected]}
                    >
                      <View style={styles.groupInitials}><Text style={styles.groupInitialsText}>{group.name.slice(0, 2).toUpperCase()}</Text></View>
                      <Text style={styles.groupOptionText} numberOfLines={1}>{group.name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : (
              <TouchableOpacity onPress={() => nav.navigate('MainTabs', { screen: 'NewGroup' })}>
                <Text style={styles.createGroup}>Crea un grupo para proponer este evento →</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity disabled={!selectedGroupId} onPress={useForPlan} style={[styles.primary, !selectedGroupId && styles.primaryDisabled]}>
              <Text style={styles.primaryText}>{selectedGroup ? `Proponer en ${selectedGroup.name}` : 'Selecciona un grupo'}</Text>
            </TouchableOpacity>
            {!!source && (
              <TouchableOpacity onPress={() => Linking.openURL(source)} style={styles.secondary}>
                <Text style={styles.secondaryText}>Ver fuente</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      <View style={{ height: insets.bottom + 20 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paper },
  muted: { fontFamily: fonts.sans, color: colors.muted },
  card: { margin: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  media: { width: '100%', height: 320, backgroundColor: colors.paper },
  mediaImage: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8efdf' },
  placeholderText: { fontSize: 48 },
  badgeLeft: { position: 'absolute', top: 14, left: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeRight: { position: 'absolute', top: 14, right: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeLime: { backgroundColor: colors.lime, borderColor: '#cde08a' },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.ink },
  badgeLimeText: { color: colors.olive },
  body: { padding: 24, gap: 18 },
  title: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink, textAlign: 'center' },
  meta: { gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  metaText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, flex: 1 },
  metaStrong: { fontFamily: fonts.sansBold, color: colors.ink },
  freeText: { color: '#1a7a3a' },
  desc: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16, gap: 8 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: '#5d6d62' },
  descText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 21, color: colors.ink },
  groupPicker: { padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radii.card, backgroundColor: colors.paper },
  groupPickerCopy: { gap: 2 },
  groupPickerHint: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  groupOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupOption: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.white },
  groupOptionSelected: { borderColor: colors.olive, backgroundColor: '#eef6e8' },
  groupInitials: { width: 25, height: 25, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8efdf' },
  groupInitialsText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.olive },
  groupOptionText: { flexShrink: 1, fontFamily: fonts.sansBold, fontSize: 12, color: colors.ink },
  createGroup: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.olive },
  actions: { flexDirection: 'row', gap: 12 },
  primary: { flex: 1.2, backgroundColor: colors.olive, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 16 },
  secondary: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: colors.ink, fontFamily: fonts.sansBold, fontSize: 16 },
})
