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
import { ApiError } from '@/lib/api'
import { startSignIn, verifySignIn, verifySignUp } from '@/lib/auth-api'
import { useAuth } from '@/lib/auth'

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }

function requiredParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return first && first.length > 0 ? first : null
  }
  return value && value.length > 0 ? value : null
}

function RestartLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="verify-restart"
      accessible
      accessibilityRole="button"
      accessibilityLabel="最初からやり直す"
      style={styles.linkButton}
      onPress={onPress}
    >
      <Text style={styles.linkText} accessible={false}>
        最初からやり直す
      </Text>
    </Pressable>
  )
}

function InvalidRouteVerify({ onRestart }: { onRestart: () => void }) {
  return (
    <View style={styles.container} testID="verify-root">
      <Text style={styles.error} testID="auth-error">
        確認に必要な情報がありません。最初からやり直してください。
      </Text>
      <RestartLink onPress={onRestart} />
    </View>
  )
}

function VerifyForm({
  username,
  session,
  flow,
  onRestart,
}: {
  username: string
  session: string | null
  flow: 'sign-in' | 'sign-up'
  onRestart: () => void
}) {
  const { setSession } = useAuth()
  const [code, setCode] = useState('')
  const [challengeSession, setChallengeSession] = useState(session)
  const [state, setState] = useState<ScreenState>({ kind: 'idle' })

  const submit = async () => {
    setState({ kind: 'loading' })
    try {
      const input = { username, session: challengeSession, code: code.trim() }
      const response =
        flow === 'sign-in' ? await verifySignIn(input) : await verifySignUp(input)
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

  const resend = async () => {
    setState({ kind: 'loading' })
    try {
      const response = await startSignIn(username)
      setChallengeSession(response.session)
      setCode('')
      setState({ kind: 'idle' })
    } catch (error) {
      setState({ kind: 'error', message: error instanceof ApiError ? error.message : 'コードの再送に失敗しました。再試行してください。' })
    }
  }

  return (
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
        placeholder={flow === 'sign-in' ? '12345678' : '123456'}
        maxLength={flow === 'sign-in' ? 8 : 6}
      />

      {state.kind === 'error' ? (
        <Text style={styles.error} testID="auth-error">{state.message}</Text>
      ) : null}

      {state.kind === 'loading' ? (
        <ActivityIndicator testID="verify-loading" style={styles.loading} />
      ) : (
        <Pressable
          testID="verify-submit"
          accessible
          accessibilityRole="button"
          accessibilityLabel={state.kind === 'error' ? '再試行' : 'Confirm'}
          style={styles.button}
          onPress={() => {
            void submit()
          }}
        >
          <Text style={styles.buttonText} accessible={false}>
            {state.kind === 'error' ? '再試行' : 'Confirm'}
          </Text>
        </Pressable>
      )}

      <RestartLink onPress={onRestart} />
      {flow === 'sign-in' && state.kind !== 'loading' ? <Pressable testID="verify-resend" accessible accessibilityRole="button" accessibilityLabel="コードを再送" style={styles.linkButton} onPress={() => { void resend() }}><Text style={styles.linkText} accessible={false}>コードを再送</Text></Pressable> : null}
    </View>
  )
}

export default function VerifyScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ username: string; session?: string; flow?: string }>()
  const username = requiredParam(params.username)
  const session = requiredParam(params.session)
  const onRestart = () => {
    router.replace(params.flow === 'sign-in' ? '/sign-in' : '/sign-up')
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Verify' }} />
      {username === null || (params.flow === 'sign-in' && session === null) ? (
        <InvalidRouteVerify onRestart={onRestart} />
      ) : (
        <VerifyForm username={username} session={session} flow={params.flow === 'sign-in' ? 'sign-in' : 'sign-up'} onRestart={onRestart} />
      )}
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
