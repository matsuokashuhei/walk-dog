import { Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

export default function SignUpPlaceholderScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sign Up' }} />
      <View style={styles.container} testID="sign-up-root">
        <Text style={styles.body}>Sign Up form lands in the next task.</Text>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F4EF',
  },
  body: {
    fontSize: 16,
    color: '#444',
  },
})
