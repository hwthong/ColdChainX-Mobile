import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type GoodsType = 'Food' | 'Pharma' | 'Vaccine';

interface GoodsTypeSelectorProps {
  value: GoodsType;
  onChange: (value: GoodsType) => void;
}

const GOODS_TYPES: { id: GoodsType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Food', label: 'Thực phẩm', icon: 'restaurant-outline' },
  { id: 'Pharma', label: 'Dược phẩm', icon: 'medkit-outline' },
  { id: 'Vaccine', label: 'Vaccine', icon: 'flask-outline' },
];

export function GoodsTypeSelector({ value, onChange }: GoodsTypeSelectorProps) {
  return (
    <View className="bg-white rounded-2xl p-6 shadow-sm border border-[#DAC2B6]/50 gap-4">
      <Text className="text-[#8B4513] font-bold text-base">Phân Loại Hàng Hóa</Text>
      <View className="flex-row gap-3">
        {GOODS_TYPES.map((type) => {
          const isActive = value === type.id;
          return (
            <Pressable
              key={type.id}
              onPress={() => onChange(type.id)}
              className={`flex-1 h-[90px] rounded-2xl border-[1.5px] items-center justify-center gap-2 transition-all ${
                isActive
                  ? 'border-[#8B4513] bg-[#8B4513]'
                  : 'border-[#DAC2B6]/50 bg-[#F8F9FA] active:bg-[#F2EFEA]'
              }`}
              style={
                isActive
                  ? {
                      shadowColor: '#8B4513',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 10,
                      elevation: 5,
                    }
                  : {}
              }
            >
              <Ionicons
                name={type.icon}
                size={28}
                color={isActive ? '#C5A059' : '#8B4513'}
              />
              <Text
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  isActive ? 'text-white' : 'text-[#877369]'
                }`}
              >
                {type.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
