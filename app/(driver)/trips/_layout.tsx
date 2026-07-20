import { Stack } from 'expo-router';

export default function DriverTripsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="[id]/documents" />
      <Stack.Screen name="[id]/incident" />
    </Stack>
  );
}
