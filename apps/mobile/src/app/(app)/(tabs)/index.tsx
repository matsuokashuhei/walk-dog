import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { listDogs, type CurrentGoalResponse, type DogResponse } from '@/lib/dog-api'

type DogListItem = Omit<DogResponse, 'requestId'>

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'list'; dogs: DogListItem[] }
  | { kind: 'error' }

function goalSubtitle(goal: CurrentGoalResponse): string {
  return `${goal.minutes} min ${goal.period} goal`
}

export default function DogsListScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [state, setState] = useState<ScreenState>({ kind: 'loading' })

  const load = useCallback(() => {
    if (!session) {
      throw new Error('DogsList requires an authenticated session')
    }
    void listDogs(session.accessToken)
      .then((result) => {
        setState(
          result.dogs.length === 0
            ? { kind: 'empty' }
            : { kind: 'list', dogs: result.dogs },
        )
      })
      .catch(() => {
        setState({ kind: 'error' })
      })
  }, [session])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const retry = () => {
    setState({ kind: 'loading' })
    load()
  }

  return (
    <View style={styles.container} testID="dogs-list-root">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Dogs</Text>
        <Pressable
          testID="dogs-list-add"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Dog を登録"
          onPress={() => {
            router.push('/dogs/new')
          }}
        >
          <Text style={styles.add} accessible={false}>
            ＋
          </Text>
        </Pressable>
      </View>

      {state.kind === 'loading' ? (
        <Text style={styles.busy}>読み込み中…</Text>
      ) : null}

      {state.kind === 'empty' ? (
        <Text style={styles.help}>まだ Dog がいません。登録すると散歩に選べます。</Text>
      ) : null}

      {state.kind === 'error' ? (
        <Text style={styles.error}>一覧を取得できませんでした。再試行してください。</Text>
      ) : null}

      {state.kind === 'list' ? (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
          {state.dogs.map((dog) => (
            <Pressable
              key={dog.dogId}
              testID={`dogs-list-row-${dog.dogId}`}
              accessible
              accessibilityRole="button"
              accessibilityLabel={dog.name}
              style={styles.row}
              onPress={() => {
                router.push(`/dogs/${dog.dogId}`)
              }}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText} accessible={false}>
                  {dog.name.slice(0, 1)}
                </Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{dog.name}</Text>
                <Text style={styles.rowGoal}>{goalSubtitle(dog.currentGoal)}</Text>
              </View>
              <Text style={styles.chevron} accessible={false}>
                ›
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.spacer} />
      )}

      {state.kind === 'empty' ? (
        <Pressable
          testID="dogs-list-empty-register"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Dog を登録"
          style={styles.primary}
          onPress={() => {
            router.push('/dogs/new')
          }}
        >
          <Text style={styles.primaryText} accessible={false}>
            Dog を登録
          </Text>
        </Pressable>
      ) : null}

      {state.kind === 'error' ? (
        <Pressable
          testID="dogs-list-retry"
          accessible
          accessibilityRole="button"
          accessibilityLabel="再試行"
          style={styles.primary}
          onPress={retry}
        >
          <Text style={styles.primaryText} accessible={false}>
            再試行
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        testID="dogs-list-settings"
        accessible
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={styles.ghost}
        onPress={() => {
          router.push('/settings')
        }}
      >
        <Text style={styles.ghostText} accessible={false}>
          Settings
        </Text>
      </Pressable>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  add: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1F6FEB',
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
  error: {
    color: '#B42318',
    fontSize: 14,
    backgroundColor: '#F8ECE8',
    borderRadius: 10,
    padding: 10,
  },
  listScroll: {
    flex: 1,
  },
  list: {
    gap: 10,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D9D0C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  rowGoal: {
    fontSize: 13,
    color: '#6B645A',
  },
  chevron: {
    color: '#6B645A',
    fontSize: 20,
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
