import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TemperatureSelectorProps {
  temperature: number;
  setTemperature: (temp: number) => void;
}

export function TemperatureSelector({ temperature, setTemperature }: TemperatureSelectorProps) {
  const decrease = () => setTemperature(temperature - 1);
  const increase = () => setTemperature(temperature + 1);

  return (
    <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 gap-4">
      <View className="flex-row items-center justify-between border-b border-[#DAC2B6]/30 pb-3">
        <Text className="text-[#8B4513] font-bold text-base">Nhiệt Độ Yêu Cầu</Text>
        <View className="px-3 py-1.5 rounded-full bg-[#006E0A]/10 border border-[#006E0A]/20 flex-row items-center gap-1.5">
          <Ionicons name="thermometer-outline" size={14} color="#006E0A" />
          <Text className="text-[#006E0A] font-bold text-[10px] uppercase tracking-wide">
            Đề xuất
          </Text>
        </View>
      </View>

      <View className="items-center py-4">
        <View className="w-36 h-36 rounded-full border-[8px] border-[#F8F9FA] bg-white items-center justify-center mb-6 shadow-sm">
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
            className="w-12 h-12 rounded-full bg-[#F8F9FA] border border-[#DAC2B6]/50 items-center justify-center active:bg-[#F2EFEA]"
          >
            <Ionicons name="remove" size={24} color="#8B4513" />
          </Pressable>
          
          <Pressable
            onPress={increase}
            className="w-12 h-12 rounded-full bg-[#F8F9FA] border border-[#DAC2B6]/50 items-center justify-center active:bg-[#F2EFEA]"
          >
            <Ionicons name="add" size={24} color="#8B4513" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
