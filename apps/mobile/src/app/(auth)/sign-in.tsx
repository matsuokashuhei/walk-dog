import * as WebBrowser from 'expo-web-browser'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { z } from 'zod'
import { ApiError } from '@/lib/api'
import { startSignIn } from '@/lib/auth-api'

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }

export default function SignInScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const submit = async () => {
    const value = email.trim()
    if (!z.email().safeParse(value).success) {
      setState({ kind: 'error', message: '有効なメールアドレスを入力してください。' })
      return
    }
    setState({ kind: 'loading' })
    try {
      const response = await startSignIn(value)
      router.push({ pathname: '/verify', params: { username: response.username, session: response.session, flow: 'sign-in' } })
      setState({ kind: 'idle' })
    } catch (error) {
      setState({ kind: 'error', message: error instanceof ApiError ? error.message : 'サインインに失敗しました。再試行してください。' })
    }
  }
  return (
    <>
      <Stack.Screen options={{ title: 'Sign In' }} />
      <ScrollView contentContainerStyle={styles.container} testID="sign-in-root">
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput
          testID="sign-in-email"
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
        {state.kind === 'error' ? <Text style={styles.error} testID="auth-error">{state.message}</Text> : null}
        {state.kind === 'loading' ? (
          <ActivityIndicator testID="sign-in-loading" />
        ) : (
          <Pressable testID="sign-in-submit" accessible accessibilityRole="button" accessibilityLabel="Continue" style={styles.button} onPress={() => { void submit() }}>
            <Text style={styles.buttonText} accessible={false}>Continue</Text>
          </Pressable>
        )}
        <Pressable testID="sign-in-create-account" accessible accessibilityRole="button" accessibilityLabel="Create account" onPress={() => router.push('/sign-up')}>
          <Text style={styles.link}>Create account</Text>
        </Pressable>
        <View style={styles.legal}>
          <Pressable onPress={() => { void WebBrowser.openBrowserAsync('https://cacheandbuffer.com/') }}>
            <Text style={styles.link}>利用規約</Text>
          </Pressable>
          <Text> と </Text>
          <Pressable onPress={() => { void WebBrowser.openBrowserAsync('https://cacheandbuffer.com/') }}>
            <Text style={styles.link}>プライバシーポリシー</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F7F4EF', gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#333' },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFF' },
  button: { marginTop: 8, backgroundColor: '#1F6FEB', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  link: { color: '#1F6FEB', fontSize: 14, textAlign: 'center' },
  legal: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'center' },
  error: { color: '#B42318', fontSize: 14 },
})
