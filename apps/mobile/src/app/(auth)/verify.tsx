import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ApiError, apiRequest } from '@/lib/api'
import { useAuth } from '@/lib/auth'

type VerifyResponse = {
  requestId: string
  accessToken: string
  idToken: string
  refreshToken: string
  owner: {
    ownerId: string
    displayName: string | null
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
  }
}

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}

export default function VerifyScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ username?: string; session?: string }>()
  const { setSession } = useAuth()
  const username = firstParam(params.username)
  const session = firstParam(params.session)
  const [code, setCode] = useState('')
  const [state, setState] = useState<ScreenState>({ kind: 'idle' })

  const submit = async () => {
    setState({ kind: 'loading' })
    try {
      const response = await apiRequest<VerifyResponse>('/v1/auth/verify', {
        method: 'POST',
        body: { username, session, code: code.trim() },
      })
      await setSession({
        accessToken: response.accessToken,
        idToken: response.idToken,
        refreshToken: response.refreshToken,
      })
      setState({ kind: 'idle' })
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : '確認に失敗しました。再試行してください。'
      setState({ kind: 'error', message })
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Verify' }} />
      <View style={styles.container} testID="verify-root">
        <Text style={styles.label}>One-time code</Text>
        <TextInput
          testID="verify-code"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          value={code}
          onChangeText={setCode}
          editable={state.kind !== 'loading'}
          placeholder="123456"
        />

        {state.kind === 'error' ? (
          <Text style={styles.error} testID="auth-error">{state.message}</Text>
        ) : null}

        {state.kind === 'loading' ? (
          <ActivityIndicator testID="verify-loading" style={styles.loading} />
        ) : (
          <Pressable
            testID="verify-submit"
            style={styles.button}
            onPress={() => {
              void submit()
            }}
          >
            <Text style={styles.buttonText}>
              {state.kind === 'error' ? '再試行' : 'Confirm'}
            </Text>
          </Pressable>
        )}

        <Pressable
          testID="verify-restart"
          style={styles.linkButton}
          onPress={() => {
            router.replace('/sign-up')
          }}
        >
          <Text style={styles.linkText}>最初からやり直す</Text>
        </Pressable>
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#1F6FEB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: '#1F6FEB',
    fontSize: 14,
  },
  error: {
    color: '#B42318',
    fontSize: 14,
  },
  loading: {
    marginTop: 16,
  },
})
