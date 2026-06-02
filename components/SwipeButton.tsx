import { Pressable, Text, View } from 'react-native';

type SwipeButtonProps = {
  label?: string;
  disabled?: boolean;
  className?: string;
  onPress?: () => void;
};

export function SwipeButton({
  label = 'Swipe to start',
  disabled = false,
  className = '',
  onPress,
}: SwipeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={[
        'relative h-14 items-center justify-center overflow-hidden rounded-lg bg-brown-dark px-16',
        disabled ? 'opacity-60' : 'active:opacity-90',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <View className="absolute left-1 top-1 h-12 w-12 items-center justify-center rounded-lg bg-white/90">
        <Text className="text-xl font-bold text-brown-dark">{'>'}</Text>
      </View>
      <Text className="text-center font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export default SwipeButton;
