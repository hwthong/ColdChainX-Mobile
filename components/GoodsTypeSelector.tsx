import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type GoodsType = 'MEAT_SEAFOOD' | 'FROZEN_FRUITS_VEGGIES' | 'PHARMACEUTICALS';

interface GoodsTypeSelectorProps {
  value: GoodsType;
  onChange: (value: GoodsType) => void;
}

const GOODS_TYPES: { id: GoodsType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'FROZEN_FRUITS_VEGGIES', label: 'Thực phẩm đông lạnh', icon: 'restaurant-outline' },
  { id: 'PHARMACEUTICALS', label: 'Dược phẩm', icon: 'medkit-outline' },
  { id: 'MEAT_SEAFOOD', label: 'Thịt / Hải sản', icon: 'fish-outline' },
];

export function GoodsTypeSelector({ value, onChange }: GoodsTypeSelectorProps) {
  return (
    <View className="bg-white rounded-2xl p-5 shadow-sm border border-[#DAC2B6]/50 gap-4">
      <View className="flex-row items-center gap-2 border-b border-[#DAC2B6]/30 pb-3">
        <Ionicons name="pricetags-outline" size={18} color="#8B4513" />
        <Text className="text-[#8B4513] font-bold text-base">Phân loại hàng hóa</Text>
      </View>

      <View className="gap-3">
        {GOODS_TYPES.map((type) => {
          const isActive = value === type.id;

          return (
            <Pressable
              key={type.id}
              onPress={() => onChange(type.id)}
              className={[
                'min-h-[66px] w-full rounded-2xl border-[1.5px] px-4 py-3 flex-row items-center gap-3',
                isActive ? 'border-[#8B4513] bg-[#8B4513]' : 'border-[#DAC2B6]/50 bg-[#F8F9FA]',
              ].join(' ')}
            >
              <View
                className={[
                  'h-10 w-10 items-center justify-center rounded-full',
                  isActive ? 'bg-white/15' : 'bg-[#8B4513]/10',
                ].join(' ')}
              >
                <Ionicons name={type.icon} size={22} color={isActive ? '#FFC29F' : '#8B4513'} />
              </View>

              <View className="flex-1">
                <Text className={['text-sm font-bold', isActive ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
                  {type.label}
                </Text>
                <Text className={['mt-1 text-[11px]', isActive ? 'text-white/70' : 'text-[#877369]'].join(' ')}>
                  {type.id}
                </Text>
              </View>

              {isActive ? <Ionicons name="checkmark-circle" size={20} color="#FFC29F" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
