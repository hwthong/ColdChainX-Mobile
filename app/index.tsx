import { Text, View } from 'react-native';
import { colors } from '../constants/colors';

export default function IndexScreen() {
  return (
    <View style={{ backgroundColor: colors.surface.page }} className="flex-1 items-center justify-center px-6">
      <Text style={{ color: colors.brand.primary }} className="text-3xl font-bold">ColdChainX</Text>
      <Text style={{ color: colors.text.secondary }} className="mt-3 text-center text-base">Preparing your workspace...</Text>
    </View>
  );
}
