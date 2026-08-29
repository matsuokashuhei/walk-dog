import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '@/lib/auth'
import { stopTrackPointUpdates } from '@/lib/walk-location-task'

function RootNavigator() {
  const { isReady, session } = useAuth()

  useEffect(() => {
    if (isReady && session === null) {
      void stopTrackPointUpdates()
    }
  }, [isReady, session])

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )
}
