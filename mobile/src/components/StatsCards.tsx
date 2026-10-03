import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type Card = {
  icon: keyof typeof Ionicons.glyphMap
  value: number
  label: string
}

type Props = {
  cards: Card[]
}

export default function StatsCards({ cards }: Props) {
  return (
    <View style={styles.row}>
      {cards.map((card, i) => (
        <View key={i} style={styles.card}>
          <Ionicons name={card.icon} size={18} color="#28533a" style={styles.icon} />
          <Text style={styles.num}>{card.value}</Text>
          <Text style={styles.label}>{card.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9ddd4',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 4,
  },
  num: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 22,
    lineHeight: 22,
    color: '#28533a',
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: '#69746d',
    marginTop: 4,
  },
})
