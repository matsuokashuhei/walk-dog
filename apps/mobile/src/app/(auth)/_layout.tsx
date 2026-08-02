import { Stack } from 'expo-router'

export const unstable_settings = {
  initialRouteName: 'sign-up',
}

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
      }}
    />
  )
}
