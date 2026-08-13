import * as WebBrowser from 'expo-web-browser'
import { Stack } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { hasActiveWalk } from '@/lib/active-walk'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { signOut } from '@/lib/auth-api'

const LEGAL_URL = 'https://cacheandbuffer.com/'

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }

export default function SettingsScreen() {
  const { session, clearSession } = useAuth()
  const [state, setState] = useState<ScreenState>({ kind: 'idle' })

  const runSignOut = async () => {
    if (!session) {
      throw new Error('Settings requires an authenticated session')
    }

    setState({ kind: 'loading' })
    try {
      await signOut(session.accessToken)
      await clearSession()
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof ApiError
            ? error.message
            : 'サインアウトに失敗しました。再試行してください。',
      })
    }
  }

  const onPressSignOut = () => {
    if (state.kind === 'loading') {
      return
    }

    if (hasActiveWalk()) {
      Alert.alert(
        'Active Walk を破棄しますか？',
        'サインアウトすると、記録中の散歩は Failed になります。',
        [
          {
            text: 'キャンセル',
            style: 'cancel',
            onPress: () => {
              setState({ kind: 'idle' })
            },
          },
          {
            text: '破棄して Sign Out',
            style: 'destructive',
            onPress: () => {
              void runSignOut()
            },
          },
        ],
      )
      return
    }

    void runSignOut()
  }

  const openLegal = () => {
    void WebBrowser.openBrowserAsync(LEGAL_URL)
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <View style={styles.container} testID="settings-root">
        <Text style={styles.title}>Settings</Text>
        <View style={styles.legal}>
          <Pressable
            testID="settings-terms"
            accessible
            accessibilityRole="link"
            accessibilityLabel="利用規約"
            onPress={openLegal}
          >
            <Text style={styles.link}>利用規約</Text>
          </Pressable>
          <Pressable
            testID="settings-privacy"
            accessible
            accessibilityRole="link"
            accessibilityLabel="プライバシーポリシー"
            onPress={openLegal}
          >
            <Text style={styles.link}>プライバシーポリシー</Text>
          </Pressable>
          <Pressable
            testID="settings-app-info"
            accessible
            accessibilityRole="link"
            accessibilityLabel="アプリ情報"
            onPress={openLegal}
          >
            <Text style={styles.link}>アプリ情報</Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />

        {state.kind === 'error' ? (
          <Text style={styles.error} testID="settings-error">
            {state.message}
          </Text>
        ) : null}

        {state.kind === 'loading' ? (
          <View style={styles.loading} testID="settings-loading">
            <ActivityIndicator />
            <Text style={styles.loadingText}>Signing out…</Text>
          </View>
        ) : (
          <Pressable
            testID="settings-sign-out"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Sign Out"
            style={styles.signOutButton}
            onPress={onPressSignOut}
          >
            <Text style={styles.signOutText} accessible={false}>
              Sign Out
            </Text>
          </Pressable>
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F7F4EF',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  legal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  link: {
    color: '#1F6FEB',
    fontSize: 14,
  },
  spacer: {
    flex: 1,
  },
  error: {
    color: '#B42318',
    fontSize: 14,
    backgroundColor: '#F8ECE8',
    borderRadius: 10,
    padding: 10,
  },
  loading: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  signOutButton: {
    backgroundColor: '#F3E2DC',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#8A3B2C',
    fontSize: 16,
    fontWeight: '600',
  },
})
