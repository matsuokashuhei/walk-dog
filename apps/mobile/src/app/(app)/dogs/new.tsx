import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { createDog, type Birthday, type DogResponse } from '@/lib/dog-api'

const INVALID_MESSAGE = '名前は1〜100文字で入力してください。'
const RETRY_MESSAGE = '登録に失敗しました。再試行してください。'

type Gender = DogResponse['gender']

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }

function trimmedLength(value: string): number {
  return value.trim().length
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed)) {
    return null
  }
  return parsed
}

function isFilled(value: string): boolean {
  return value.trim() !== ''
}

type ParsedBirthday = { ok: true; birthday?: Birthday } | { ok: false }

function parseBirthday(year: string, month: string, day: string): ParsedBirthday {
  const yearFilled = isFilled(year)
  const monthFilled = isFilled(month)
  const dayFilled = isFilled(day)
  if (!yearFilled && !monthFilled && !dayFilled) {
    return { ok: true }
  }

  const yearValue = parseOptionalInt(year)
  const monthValue = parseOptionalInt(month)
  const dayValue = parseOptionalInt(day)

  if (yearFilled && !monthFilled && !dayFilled) {
    if (yearValue === null) {
      return { ok: false }
    }
    return { ok: true, birthday: { precision: 'year', year: yearValue } }
  }

  if (yearFilled && monthFilled && !dayFilled) {
    if (yearValue === null || monthValue === null || monthValue < 1 || monthValue > 12) {
      return { ok: false }
    }
    return { ok: true, birthday: { precision: 'month', year: yearValue, month: monthValue } }
  }

  if (yearFilled && monthFilled && dayFilled) {
    if (
      yearValue === null ||
      monthValue === null ||
      dayValue === null ||
      monthValue < 1 ||
      monthValue > 12 ||
      dayValue < 1 ||
      dayValue > 31
    ) {
      return { ok: false }
    }
    return {
      ok: true,
      birthday: { precision: 'day', year: yearValue, month: monthValue, day: dayValue },
    }
  }

  return { ok: false }
}

export default function RegisterDogScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [state, setState] = useState<ScreenState>({ kind: 'idle' })
  const submitting = state.kind === 'submitting'
  const parsedBirthday = parseBirthday(year, month, day)
  const canSubmit =
    trimmedLength(name) >= 1 &&
    trimmedLength(name) <= 100 &&
    gender !== null &&
    parsedBirthday.ok
  const dirty =
    name.length > 0 || gender !== null || year.length > 0 || month.length > 0 || day.length > 0
  const errorMessage =
    state.kind === 'invalid'
      ? INVALID_MESSAGE
      : state.kind === 'error'
        ? state.message
        : null
  const nameInvalid = state.kind === 'invalid' || state.kind === 'error'

  const clearStatus = () => {
    if (state.kind === 'invalid' || state.kind === 'error') {
      setState({ kind: 'idle' })
    }
  }

  const submit = async () => {
    if (submitting || !canSubmit || gender === null) {
      return
    }

    if (!session) {
      throw new Error('RegisterDog requires an authenticated session')
    }

    const birthdayResult = parseBirthday(year, month, day)
    if (!birthdayResult.ok) {
      return
    }

    setState({ kind: 'submitting' })
    try {
      await createDog(session.accessToken, {
        name: name.trim(),
        gender,
        ...(birthdayResult.birthday === undefined ? {} : { birthday: birthdayResult.birthday }),
      })
      router.replace('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setState({ kind: 'invalid' })
        return
      }
      if (error instanceof ApiError && error.status === 409) {
        setState({ kind: 'error', message: error.message })
        return
      }
      setState({ kind: 'error', message: RETRY_MESSAGE })
    }
  }

  const onBack = () => {
    if (submitting) {
      return
    }
    if (!dirty) {
      router.back()
      return
    }
    Alert.alert('入力を破棄しますか？', '戻ると入力した内容は消えます。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '破棄する',
        style: 'destructive',
        onPress: () => {
          router.back()
        },
      },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="dog-new-root"
    >
      <Text style={styles.label}>new dog</Text>
      <Text style={styles.title}>Dog を登録</Text>
      <Text style={styles.help}>名前は 1〜100 文字。Goal は Daily 30分で作成します。</Text>
      <TextInput
        testID="dog-new-name"
        style={[styles.input, nameInvalid ? styles.inputInvalid : null]}
        value={name}
        onChangeText={(value) => {
          setName(value)
          clearStatus()
        }}
        placeholder="名前"
        editable={!submitting}
        maxLength={100}
        autoCorrect={false}
        returnKeyType="next"
      />
      <View style={styles.choice}>
        <GenderChip
          testID="dog-new-gender-male"
          label="Male"
          selected={gender === 'male'}
          disabled={submitting}
          onPress={() => {
            setGender('male')
            clearStatus()
          }}
        />
        <GenderChip
          testID="dog-new-gender-female"
          label="Female"
          selected={gender === 'female'}
          disabled={submitting}
          onPress={() => {
            setGender('female')
            clearStatus()
          }}
        />
        <GenderChip
          testID="dog-new-gender-unknown"
          label="Unknown"
          selected={gender === 'unknown'}
          disabled={submitting}
          onPress={() => {
            setGender('unknown')
            clearStatus()
          }}
        />
      </View>
      <Text style={styles.birthdayLabel}>誕生日（任意）</Text>
      <View style={styles.birthdayRow}>
        <TextInput
          style={[styles.birthdayInput, parsedBirthday.ok ? null : styles.inputInvalid]}
          value={year}
          onChangeText={(value) => {
            setYear(value)
            clearStatus()
          }}
          placeholder="年"
          keyboardType="number-pad"
          editable={!submitting}
          maxLength={4}
        />
        <Text style={styles.birthdaySlash}>/</Text>
        <TextInput
          style={[styles.birthdayInput, parsedBirthday.ok ? null : styles.inputInvalid]}
          value={month}
          onChangeText={(value) => {
            setMonth(value)
            clearStatus()
          }}
          placeholder="月"
          keyboardType="number-pad"
          editable={!submitting}
          maxLength={2}
        />
        <Text style={styles.birthdaySlash}>/</Text>
        <TextInput
          style={[styles.birthdayInput, parsedBirthday.ok ? null : styles.inputInvalid]}
          value={day}
          onChangeText={(value) => {
            setDay(value)
            clearStatus()
          }}
          placeholder="日"
          keyboardType="number-pad"
          editable={!submitting}
          maxLength={2}
        />
      </View>
      {errorMessage ? (
        <Text style={styles.error} testID="dog-new-error">
          {errorMessage}
        </Text>
      ) : null}
      <View style={styles.spacer} />
      {submitting ? <Text style={styles.busy}>登録しています…</Text> : null}
      <Pressable
        testID="dog-new-submit"
        accessible
        accessibilityRole="button"
        accessibilityLabel="登録する"
        accessibilityState={{ disabled: submitting || !canSubmit }}
        disabled={submitting || !canSubmit}
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
        testID="dog-new-back"
        accessible
        accessibilityRole="button"
        accessibilityLabel="戻る"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        style={[styles.ghost, submitting ? styles.dimmed : null]}
        onPress={onBack}
      >
        <Text style={styles.ghostText} accessible={false}>
          戻る
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  )
}

function GenderChip({
  testID,
  label,
  selected,
  disabled,
  onPress,
}: {
  testID: string
  label: string
  selected: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      style={[styles.chip, selected ? styles.chipOn : null]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextOn : null]} accessible={false}>
        {label}
      </Text>
    </Pressable>
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
  choice: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D0C3',
    borderRadius: 10,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  chipOn: {
    backgroundColor: '#1F6FEB',
    borderColor: '#1F6FEB',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  chipTextOn: {
    color: '#FFF',
  },
  birthdayLabel: {
    fontSize: 14,
    color: '#6B645A',
  },
  birthdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  birthdayInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
    textAlign: 'center',
  },
  birthdaySlash: {
    color: '#6B645A',
    fontSize: 16,
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
  ghost: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D0C3',
  },
  ghostText: {
    color: '#6B645A',
    fontSize: 16,
    fontWeight: '600',
  },
  dimmed: {
    opacity: 0.45,
  },
})
