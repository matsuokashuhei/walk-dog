import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ApiError } from '@/lib/api'
import { useOwner } from '@/lib/owner'

const INVALID_MESSAGE = '表示名は1〜100文字で入力してください。'
const RETRY_MESSAGE = '登録に失敗しました。再試行してください。'

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }

function trimmedLength(value: string): number {
  return value.trim().length
}

export default function DisplayNameScreen() {
  const router = useRouter()
  const { updateDisplayName } = useOwner()
  const [displayName, setDisplayName] = useState('')
  const [state, setState] = useState<ScreenState>({ kind: 'idle' })
  const submitting = state.kind === 'submitting'
  const canSubmit = trimmedLength(displayName) >= 1 && trimmedLength(displayName) <= 100
  const errorMessage =
    state.kind === 'invalid'
      ? INVALID_MESSAGE
      : state.kind === 'error'
        ? state.message
        : null

  const submit = async () => {
    if (submitting) {
      return
    }
    if (!canSubmit) {
      setState({ kind: 'invalid' })
      return
    }

    setState({ kind: 'submitting' })
    try {
      await updateDisplayName(displayName.trim())
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setState({ kind: 'invalid' })
        return
      }
      setState({
        kind: 'error',
        message: error instanceof ApiError ? error.message : RETRY_MESSAGE,
      })
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="display-name-root"
    >
      <Text style={styles.label}>owner</Text>
      <Text style={styles.title}>表示名を登録</Text>
      <Text style={styles.help}>散歩の記録に使う名前です。1〜100文字。</Text>
      <TextInput
        testID="display-name-input"
        style={[styles.input, state.kind === 'invalid' ? styles.inputInvalid : null]}
        value={displayName}
        onChangeText={(value) => {
          setDisplayName(value)
          if (state.kind === 'invalid' || state.kind === 'error') {
            setState({ kind: 'idle' })
          }
        }}
        placeholder="表示名"
        editable={!submitting}
        maxLength={100}
        autoCorrect={false}
        returnKeyType="done"
      />
      {errorMessage ? (
        <Text style={styles.error} testID="display-name-error">
          {errorMessage}
        </Text>
      ) : null}
      <View style={styles.spacer} />
      {submitting ? (
        <Text style={styles.busy}>登録しています…</Text>
      ) : null}
      <Pressable
        testID="display-name-submit"
        accessible
        accessibilityRole="button"
        accessibilityLabel="登録する"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        style={[
          styles.submit,
          canSubmit && !submitting ? styles.submitReady : styles.submitDisabled,
          submitting ? styles.dimmed : null,
        ]}
        onPress={() => {
          void submit()
        }}
      >
        <Text
          style={[
            styles.submitText,
            canSubmit && !submitting ? styles.submitTextReady : styles.submitTextDisabled,
          ]}
          accessible={false}
        >
          登録する
        </Text>
      </Pressable>
      <Pressable
        testID="display-name-settings"
        accessible
        accessibilityRole="button"
        accessibilityLabel="Settings"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        style={[styles.settings, submitting ? styles.dimmed : null]}
        onPress={() => {
          router.push('/settings')
        }}
      >
        <Text style={styles.settingsText} accessible={false}>
          Settings
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F7F4EF',
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6B645A',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  help: {
    fontSize: 16,
    color: '#444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  inputInvalid: {
    borderColor: '#8A3B2C',
  },
  error: {
    color: '#B42318',
    fontSize: 14,
    backgroundColor: '#F8ECE8',
    borderRadius: 10,
    padding: 10,
  },
  spacer: {
    flex: 1,
  },
  busy: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  submit: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitReady: {
    backgroundColor: '#1F6FEB',
  },
  submitDisabled: {
    backgroundColor: '#ECE5DA',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitTextReady: {
    color: '#FFF',
  },
  submitTextDisabled: {
    color: '#6B645A',
  },
  settings: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D0C3',
  },
  settingsText: {
    color: '#6B645A',
    fontSize: 16,
    fontWeight: '600',
  },
  dimmed: {
    opacity: 0.45,
  },
})
