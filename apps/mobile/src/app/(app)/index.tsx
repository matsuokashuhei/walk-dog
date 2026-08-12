import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export default function HomeScreen() {
  const router = useRouter()

  return (
    <View style={styles.container} testID="home-root">
      <Text style={styles.title}>walk / dog</Text>
      <Text style={styles.body}>Signed in. Dogs List arrives in Step 2.</Text>
      <Pressable
        testID="home-settings"
        accessible
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={styles.settingsButton}
        onPress={() => {
          router.push('/settings')
        }}
      >
        <Text style={styles.settingsButtonText} accessible={false}>
          Settings
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F4EF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    color: '#444',
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: '#1F6FEB',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  settingsButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
