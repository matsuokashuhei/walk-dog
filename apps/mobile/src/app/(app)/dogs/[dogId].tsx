import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { getDog, type Birthday, type CurrentGoalResponse, type DogResponse } from '@/lib/dog-api'

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'ready'; dog: DogResponse }
  | { kind: 'not_found' }
  | { kind: 'error' }

const GENDER_LABEL: Record<DogResponse['gender'], string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Unknown',
}

function formatBirthday(birthday: Birthday): string {
  switch (birthday.precision) {
    case 'unknown':
      return 'Unknown'
    case 'year':
      return String(birthday.year)
    case 'month':
      return `${birthday.year} / ${birthday.month}`
    case 'day':
      return `${birthday.year} / ${birthday.month} / ${birthday.day}`
  }
}

function formatGoal(goal: CurrentGoalResponse): string {
  const period = `${goal.period.charAt(0).toUpperCase()}${goal.period.slice(1)}`
  return `${period} ${goal.minutes} minutes`
}

export default function DogDetailScreen() {
  const router = useRouter()
  const { dogId } = useLocalSearchParams<{ dogId: string }>()
  const { session } = useAuth()
  const [state, setState] = useState<ScreenState>({ kind: 'loading' })

  const load = useCallback(() => {
    if (!session) {
      throw new Error('DogDetail requires an authenticated session')
    }
    void getDog(session.accessToken, dogId)
      .then((dog) => {
        setState({ kind: 'ready', dog })
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 404) {
          setState({ kind: 'not_found' })
          return
        }
        setState({ kind: 'error' })
      })
  }, [dogId, session])

  useEffect(() => {
    load()
  }, [load])

  const goToList = () => {
    router.replace('/')
  }

  const goBack = () => {
    router.back()
  }

  return (
    <View style={styles.container} testID="dog-detail-root">
      <Text style={styles.label}>dog</Text>

      {state.kind === 'loading' ? <Text style={styles.busy}>読み込み中…</Text> : null}

      {state.kind === 'ready' ? (
        <>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText} accessible={false}>
                {state.dog.name.slice(0, 1)}
              </Text>
            </View>
            <Text style={styles.title}>{state.dog.name}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <Text style={styles.fieldValue}>{GENDER_LABEL[state.dog.gender]}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Birthday</Text>
            <Text style={styles.fieldValue}>{formatBirthday(state.dog.birthday)}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Goal</Text>
            <Text style={styles.fieldValue}>{formatGoal(state.dog.currentGoal)}</Text>
          </View>
        </>
      ) : null}

      {state.kind === 'not_found' ? (
        <>
          <Text style={styles.title}>見つかりません</Text>
          <Text style={styles.help}>この Dog は表示できません。</Text>
        </>
      ) : null}

      {state.kind === 'error' ? (
        <Text style={styles.error}>読み込めませんでした。再試行してください。</Text>
      ) : null}

      <View style={styles.spacer} />

      {state.kind === 'error' ? (
        <Pressable
          testID="dog-detail-retry"
          accessible
          accessibilityRole="button"
          accessibilityLabel="再試行"
          style={styles.primary}
          onPress={() => {
            setState({ kind: 'loading' })
            load()
          }}
        >
          <Text style={styles.primaryText} accessible={false}>
            再試行
          </Text>
        </Pressable>
      ) : null}

      {state.kind === 'not_found' ? (
        <Pressable
          testID="dog-detail-back"
          accessible
          accessibilityRole="button"
          accessibilityLabel="一覧へ戻る"
          style={styles.primary}
          onPress={goToList}
        >
          <Text style={styles.primaryText} accessible={false}>
            一覧へ戻る
          </Text>
        </Pressable>
      ) : (
        <Pressable
          testID="dog-detail-back"
          accessible
          accessibilityRole="button"
          accessibilityLabel="戻る"
          style={styles.ghost}
          onPress={goBack}
        >
          <Text style={styles.ghostText} accessible={false}>
            戻る
          </Text>
        </Pressable>
      )}
    </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECE5DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: '#1F6FEB',
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
  busy: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  field: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D9D0C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  fieldValue: {
    fontSize: 14,
    color: '#6B645A',
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
  primary: {
    backgroundColor: '#1F6FEB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
})
