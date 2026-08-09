import { useRouter, Stack } from 'expo-router'
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

type SignUpResponse = {
  requestId: string
  username: string
  session: string | null
  codeDelivery: {
    destination: string
    attribute: string
  } | null
}

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }

export default function SignUpScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<ScreenState>({ kind: 'idle' })

  const submit = async () => {
    setState({ kind: 'loading' })
    try {
      const response = await apiRequest<SignUpResponse>('/v1/auth/sign-up', {
        method: 'POST',
        body: { email: email.trim() },
      })
      router.push({
        pathname: '/verify',
        params: {
          username: response.username,
          session: response.session ?? '',
        },
      })
      setState({ kind: 'idle' })
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : 'サインアップに失敗しました。再試行してください。'
      setState({ kind: 'error', message })
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sign Up' }} />
      <View style={styles.container} testID="sign-up-root">
        <Text style={styles.label}>Email</Text>
        <TextInput
          testID="sign-up-email"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          editable={state.kind !== 'loading'}
          placeholder="you@example.com"
        />

        {state.kind === 'error' ? (
          <Text style={styles.error} testID="auth-error">{state.message}</Text>
        ) : null}

        {state.kind === 'loading' ? (
          <ActivityIndicator testID="sign-up-loading" style={styles.loading} />
        ) : (
          <Pressable
            testID="sign-up-submit"
            accessible
            accessibilityRole="button"
            accessibilityLabel={state.kind === 'error' ? '再試行' : 'Continue'}
            style={styles.button}
            onPress={() => {
              void submit()
            }}
          >
            <Text style={styles.buttonText} accessible={false}>
              {state.kind === 'error' ? '再試行' : 'Continue'}
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
  error: {
    color: '#B42318',
    fontSize: 14,
  },
  loading: {
    marginTop: 16,
  },
})
