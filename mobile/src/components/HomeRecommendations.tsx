import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchRecommendations, type JunteFilters, type RecommendItem } from '../lib/recommendations'
import { colors, fonts, radii } from '../theme'
import QueryError from './QueryError'

const HOME_FILTERS: JunteFilters = {
  city: 'Todas',
  budget: 'Cualquiera',
  type: 'eventos',
  category: 'Todas',
  sort: 'score',
}

function formatDate(value: unknown) {
  if (typeof value !== 'string' || !value) return 'Fecha por confirmar'
  return new Intl.DateTimeFormat('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${value}T12:00:00`))
}

export default function HomeRecommendations({
  onSelect,
  onViewMore,
}: {
  onSelect: (item: RecommendItem) => void
  onViewMore: () => void
}) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['homeRecommendations'],
    queryFn: () => fetchRecommendations(HOME_FILTERS, 1, 6),
    staleTime: 5 * 60_000,
  })
  const events = data?.data ?? []

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>DESCUBRE ALGO NUEVO</Text>
          <Text style={styles.title}>Eventos para el próximo junte</Text>
        </View>
        <TouchableOpacity accessibilityRole="link" onPress={onViewMore} hitSlop={10}>
          <Text style={styles.more}>Ver más →</Text>
        </TouchableOpacity>
      </View>

      {!!error && <QueryError error={error} onRetry={() => void refetch()} />}
      {isLoading && <ActivityIndicator size="large" color={colors.olive} style={styles.loader} />}
      {!isLoading && !error && events.length === 0 && (
        <View style={styles.empty}><Text style={styles.emptyText}>No hay eventos próximos disponibles ahora mismo.</Text></View>
      )}
      {!isLoading && !error && events.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {events.map((item) => {
            const title = String(item.title ?? '')
            const image = String(item.image ?? '')
            const category = String(item.category ?? 'Evento')
            const price = String(item.price ?? item.price_tag ?? 'De pago')
            return (
              <TouchableOpacity
                key={String(item.id ?? item.slug)}
                accessibilityRole="button"
                accessibilityLabel={`Ver ${title}`}
                activeOpacity={0.85}
                style={styles.card}
                onPress={() => onSelect(item)}
              >
                <View style={styles.imageWrap}>
                  {image && image !== 'N/A' ? (
                    <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
                  ) : (
                    <Text style={styles.placeholder}>📍</Text>
                  )}
                  <View style={styles.category}><Text style={styles.categoryText} numberOfLines={1}>{category}</Text></View>
                </View>
                <View style={styles.body}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{formatDate(item.start_date)} · {String(item.province ?? '')}</Text>
                  <View style={styles.price}><Text style={styles.priceText}>{price}</Text></View>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 32, gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 7 },
  title: { fontFamily: fonts.serif, fontSize: 25, letterSpacing: -1, color: colors.ink },
  more: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.olive },
  loader: { paddingVertical: 42 },
  empty: { padding: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#b7c1b6', borderRadius: radii.card },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center' },
  rail: { gap: 12, paddingBottom: 4 },
  card: { width: 214, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white },
  imageWrap: { height: 132, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8efdf' },
  image: { width: '100%', height: '100%' },
  placeholder: { fontSize: 34 },
  category: { position: 'absolute', top: 9, left: 9, right: 9, alignSelf: 'flex-start' },
  categoryText: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.94)', fontFamily: fonts.sansBold, fontSize: 10, color: colors.ink },
  body: { padding: 12, gap: 6 },
  cardTitle: { minHeight: 39, fontFamily: fonts.serif, fontSize: 17, lineHeight: 19, color: colors.ink },
  meta: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  price: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#eef4e4' },
  priceText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.olive },
})
