import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { toUserMessage } from '../lib/errors'

export default function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No pudimos cargar esta información</Text>
      <Text style={styles.message}>{toUserMessage(error, 'El servidor no respondió correctamente.')}</Text>
      <TouchableOpacity style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { margin: 20, padding: 20, gap: 10, borderWidth: 1, borderColor: '#e0b5af', backgroundColor: '#fff7f5', borderRadius: 12, alignItems: 'center' },
  title: { color: '#18261f', fontFamily: 'DMSans_700Bold', fontSize: 14, textAlign: 'center' },
  message: { color: '#7f271d', fontFamily: 'DMSans_400Regular', fontSize: 13, textAlign: 'center' },
  button: { marginTop: 4, borderRadius: 8, backgroundColor: '#28533a', paddingVertical: 10, paddingHorizontal: 18 },
  buttonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 13 },
})

