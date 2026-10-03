import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import {
  fetchRecommendations,
  JUNTE_BUDGETS,
  JUNTE_CATEGORIES,
  JUNTE_CITIES,
  JUNTE_TYPES,
  JUNTE_SORTS,
  type JunteFilters,
  type RecommendItem,
} from '../lib/recommendations'
import { colors, fonts, fontSizes, radii } from '../theme'

function Dropdown({
  label,
  options,
  value,
  onPick,
  format,
}: {
  label: string
  options: readonly string[]
  value: string
  onPick: (v: string) => void
  format?: (v: string) => string
}) {
  const [open, setOpen] = useState(false)
  const display = format ? format(value) : value
  return (
    <View style={styles.dropdownWrap}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
        onPress={() => setOpen(true)}
        style={styles.dropdownBtn}
      >
        <Text style={styles.dropdownValue} numberOfLines={1}>
          {display}
        </Text>
        <Text style={styles.dropdownArrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options as unknown as string[]}
              keyExtractor={(o) => o}
              renderItem={({ item }) => {
                const active = value === item
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => { onPick(item); setOpen(false) }}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {format ? format(item) : item}
                    </Text>
                    {active && <Text style={styles.optionCheck}>✓</Text>}
                  </TouchableOpacity>
                )
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

export default function Recommendations({
  onSelect,
  groupId,
}: {
  onSelect?: (item: RecommendItem) => void
  groupId?: string
}) {
  const [filters, setFilters] = useState<JunteFilters>({
    city: 'Todas',
    budget: 'Cualquiera',
    type: 'todos',
    category: 'Todas',
    sort: 'score',
  })
  const [page, setPage] = useState(1)
  const { data: resp, isLoading, error, isFetching } = useQuery({
    queryKey: ['recommend', filters, page],
    queryFn: () => fetchRecommendations(filters, page),
  })
  const data = resp?.data ?? []
  const total = resp?.total ?? 0
  const hasMore = resp?.hasMore ?? false

  const update = (k: keyof JunteFilters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }))
    setPage(1)
  }

  const renderItem = ({ item }: { item: RecommendItem }) => {
    const isMovie = item.kind === 'cine'
    const title = String(item.title ?? '')
    const category = String(
      (item.category as string) ?? ((item.genres as string[])?.[0] ?? ''),
    )
    const priceTag = String(item.price_tag ?? '')
    const price = (item.price as string) ?? null
    const displayPrice = price || priceTag
    const isGratis = priceTag === 'Gratis' || displayPrice === 'Gratis'
    const image = item.image as string
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${title} ${category}`}
        onPress={() => onSelect?.(item)}
        style={styles.card}
      >
        <View style={styles.cardImage}>
          {image && image !== 'N/A' ? (
            <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>{isMovie ? '🎬' : '📍'}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            {!!category && (
              <View style={styles.pill}>
                <View style={styles.pillDot} />
                <Text style={styles.pillText}>{category}</Text>
              </View>
            )}
            <View style={[styles.pill, isGratis ? styles.pillLime : styles.pillWhite]}>
              <Text style={[styles.pillTextSmall, isGratis && styles.pillLimeText]}>
                {displayPrice || (isGratis ? 'Gratis' : 'De pago')}
              </Text>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.footerText}>Ver detalle →</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>RECOMENDADAS</Text>
        <Text style={styles.title}>¿Pa dónde vamos?</Text>
        <Text style={styles.subtitle}>Basado en padonde.do · ciudad, presupuesto y tipo</Text>
      </View>

      <View style={styles.filters}>
        <View style={styles.dropdownGrid}>
          <Dropdown label="Ciudad" options={JUNTE_CITIES} value={filters.city} onPick={(v) => update('city', v)} />
          <Dropdown label="Presupuesto" options={JUNTE_BUDGETS} value={filters.budget} onPick={(v) => update('budget', v)} />
          <Dropdown label="Tipo" options={JUNTE_TYPES} value={filters.type} onPick={(v) => update('type', v)} format={(v) => (v === 'todos' ? 'Todos' : v === 'cine' ? 'Cine' : 'Eventos')} />
          <Dropdown label="Categoría" options={JUNTE_CATEGORIES} value={filters.category} onPick={(v) => update('category', v)} />
        </View>
        <Dropdown label="Ordenar por" options={JUNTE_SORTS} value={filters.sort ?? 'score'} onPick={(v) => update('sort', v)} format={(v) => (v === 'score' ? 'Relevancia' : v === 'fecha' ? 'Fecha' : 'Precio')} />
      </View>

      {!isLoading && !error && total > 0 && (
        <Text style={styles.count}>
          {total} resultados · página {page} de {Math.ceil(total / 50)}
        </Text>
      )}
      {!!error && (
        <Text style={styles.error}>No pudimos cargar recomendaciones: {(error as Error).message}</Text>
      )}
      {!isLoading && !error && data.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No hay salidas con esos filtros</Text>
          <Text style={styles.emptyHint}>Prueba Todas / Cualquiera o cambia de categoría.</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.olive} style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => `${item.kind}-${String(item.id ?? item.slug)}`}
          numColumns={2}
          columnWrapperStyle={styles.row}
          scrollEnabled={false}
          renderItem={renderItem}
        />
      )}

      {!isLoading && !error && total > 0 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            disabled={page <= 1 || isFetching}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={[styles.pageBtn, styles.pageBtnPrev, (page <= 1 || isFetching) && styles.pageBtnDisabled]}
          >
            <Text style={styles.pageBtnPrevText}>← Anterior</Text>
          </TouchableOpacity>
          <Text style={styles.pageInfo}>Página {page}</Text>
          <TouchableOpacity
            disabled={!hasMore || isFetching}
            onPress={() => setPage((p) => p + 1)}
            style={[styles.pageBtn, styles.pageBtnNext, (!hasMore || isFetching) && styles.pageBtnDisabled]}
          >
            <Text style={styles.pageBtnNextText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!groupId && <View style={{ height: 8 }} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  header: { alignItems: 'center', gap: 4 },
  eyebrow: { fontFamily: fonts.mono, fontSize: fontSizes.eyebrow, letterSpacing: 1, color: '#5d6d62' },
  title: { fontFamily: fonts.serif, fontSize: fontSizes.heading, color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: fonts.sans, fontSize: fontSizes.caption, color: colors.muted, textAlign: 'center' },
  filters: { gap: 12, padding: 14, borderRadius: radii.card, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  dropdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dropdownWrap: { flex: 1, minWidth: '47%', gap: 6 },
  filterLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: '#5d6d62', textTransform: 'uppercase' },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radii.card, paddingHorizontal: 12, paddingVertical: 11 },
  dropdownValue: { flex: 1, fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  dropdownArrow: { fontSize: 14, color: colors.muted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(24,38,31,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 28, paddingHorizontal: 16, maxHeight: '70%' },
  modalTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, textAlign: 'center', marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionActive: { backgroundColor: '#f0f7f0', borderRadius: 8 },
  optionText: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink },
  optionTextActive: { fontFamily: fonts.sansBold, color: colors.olive },
  optionCheck: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.olive },
  count: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, textAlign: 'center' },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.error },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#b7c1b6', backgroundColor: colors.paper, borderRadius: radii.card, padding: 24, alignItems: 'center', gap: 4 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  emptyHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  row: { gap: 12 },
  card: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.paper },
  image: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8efdf' },
  placeholderText: { fontSize: 28 },
  cardBody: { padding: 12, gap: 8, alignItems: 'center' },
  cardTitle: { fontFamily: fonts.serif, fontSize: 14, color: colors.ink, textAlign: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive },
  pillText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.ink },
  pillTextSmall: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.ink },
  pillLime: { backgroundColor: colors.lime, borderColor: '#cde08a' },
  pillWhite: { backgroundColor: colors.white },
  pillLimeText: { color: colors.olive },
  cardFooter: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 4, width: '100%', alignItems: 'center' },
  footerText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.olive },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  pageBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1 },
  pageBtnPrev: { backgroundColor: colors.white, borderColor: colors.line },
  pageBtnNext: { backgroundColor: colors.olive, borderColor: colors.olive },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnPrevText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  pageBtnNextText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff' },
  pageInfo: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.muted },
})
