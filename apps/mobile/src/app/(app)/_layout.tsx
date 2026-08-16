import { Stack } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { OwnerProvider, useOwner } from '@/lib/owner'

function AppStack() {
  const { isReady, owner, loadError, reload } = useOwner()

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    )
  }

  if (loadError || owner === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError ?? '取得に失敗しました。再試行してください。'}</Text>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="再試行"
          style={styles.retry}
          onPress={reload}
        >
          <Text style={styles.retryText}>再試行</Text>
        </Pressable>
      </View>
    )
  }

  const needsDisplayName = owner.displayName === null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!needsDisplayName}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dogs/new" />
        <Stack.Screen name="dogs/[dogId]" />
      </Stack.Protected>
      <Stack.Protected guard={needsDisplayName}>
        <Stack.Screen name="owner/display-name" />
      </Stack.Protected>
      <Stack.Screen name="settings" />
    </Stack>
  )
}

export default function AppLayout() {
  return (
    <OwnerProvider>
      <AppStack />
    </OwnerProvider>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F4EF',
    gap: 12,
  },
  error: {
    color: '#B42318',
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: '#1F6FEB',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
