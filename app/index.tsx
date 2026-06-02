import { Text, View } from 'react-native';

export default function IndexScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-[#F6F8F2] px-6">
      <Text className="text-3xl font-bold text-brown-dark">ColdChainX</Text>
      <Text className="mt-3 text-center text-base text-brown-light">Preparing your workspace...</Text>
    </View>
  );
}
