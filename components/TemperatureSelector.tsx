import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TemperatureSelectorProps {
  temperature: number;
  setTemperature: (temp: number) => void;
  error?: string;
}

const MIN_TEMPERATURE_CELSIUS = -18;
const MAX_TEMPERATURE_CELSIUS = -5;

export function TemperatureSelector({ temperature, setTemperature, error }: TemperatureSelectorProps) {
  const canDecrease = temperature > MIN_TEMPERATURE_CELSIUS;
  const canIncrease = temperature < MAX_TEMPERATURE_CELSIUS;
  const decrease = () => setTemperature(Math.max(MIN_TEMPERATURE_CELSIUS, temperature - 1));
  const increase = () => setTemperature(Math.min(MAX_TEMPERATURE_CELSIUS, temperature + 1));

  return (
    <View className="bg-white rounded-2xl p-5 shadow-sm border border-[#DAC2B6]/50 gap-4">
      <View className="flex-row items-center justify-between border-b border-[#DAC2B6]/30 pb-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="thermometer-outline" size={18} color="#8B4513" />
          <Text className="text-[#8B4513] font-bold text-base">Nhiệt độ yêu cầu</Text>
        </View>
        <View className="px-3 py-1.5 rounded-full bg-[#006E0A]/10 border border-[#006E0A]/20">
          <Text className="text-[#006E0A] font-bold text-[10px] uppercase tracking-wide">
            Chuỗi lạnh
          </Text>
        </View>
      </View>

      <View className="items-center py-2">
        <View className="w-32 h-32 rounded-full border-[8px] border-[#F8F9FA] bg-white items-center justify-center mb-5 shadow-sm">
          <View className="flex-row items-start">
            <Text className="font-bold text-5xl text-[#8B4513] tracking-tighter leading-none">
              {temperature}
            </Text>
            <Text className="font-bold text-xl text-[#C5A059] tracking-tighter mt-1 ml-1">
              °C
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-center gap-6 w-full">
          <Pressable
            onPress={decrease}
            disabled={!canDecrease}
            accessibilityLabel="Giảm nhiệt độ"
            className={[
              'w-12 h-12 rounded-full bg-[#F8F9FA] border border-[#DAC2B6]/50 items-center justify-center active:bg-[#F2EFEA]',
              !canDecrease ? 'opacity-40' : '',
            ].join(' ')}
          >
            <Ionicons name="remove" size={24} color="#8B4513" />
          </Pressable>

          <Pressable
            onPress={increase}
            disabled={!canIncrease}
            accessibilityLabel="Tăng nhiệt độ"
            className={[
              'w-12 h-12 rounded-full bg-[#F8F9FA] border border-[#DAC2B6]/50 items-center justify-center active:bg-[#F2EFEA]',
              !canIncrease ? 'opacity-40' : '',
            ].join(' ')}
          >
            <Ionicons name="add" size={24} color="#8B4513" />
          </Pressable>
        </View>
      </View>

      <Text className="text-center text-xs font-semibold text-[#877369]">
        Phạm vi cho phép: -18°C đến -5°C
      </Text>
      <Text className="text-center text-xs leading-5 text-[#877369]">
        Nhiệt độ này sẽ được dùng để kiểm soát chuỗi lạnh trong quá trình vận chuyển.
      </Text>
      {error ? <Text className="text-center text-xs font-medium text-red-600">{error}</Text> : null}
    </View>
  );
}
