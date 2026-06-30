import React from 'react';
import { Pressable, Text, View } from 'react-native';

const PACKAGING_OPTIONS = [
  { label: 'Thùng carton', value: 'Carton Box' },
  { label: 'Thùng xốp giữ nhiệt', value: 'Foam Box' },
  { label: 'Thùng nhựa', value: 'Plastic Box' },
  { label: 'Pallet', value: 'Pallet' },
  { label: 'Thùng', value: 'Thùng' },
  { label: 'Bao', value: 'Bao' },
];

interface PackagingTypeSelectorProps {
  selectedTypes: string[];
  onChange: (selected: string[]) => void;
}

export function PackagingTypeSelector({ selectedTypes, onChange }: PackagingTypeSelectorProps) {
  const toggleOption = (value: string) => {
    if (selectedTypes.includes(value)) {
      onChange(selectedTypes.filter((type) => type !== value));
    } else {
      onChange([...selectedTypes, value]);
    }
  };

  return (
    <View className="flex-row flex-wrap gap-2 mt-2">
      {PACKAGING_OPTIONS.map((option) => {
        const isSelected = selectedTypes.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => toggleOption(option.value)}
            className={[
              'px-4 py-2.5 rounded-full border',
              isSelected
                ? 'bg-[#8B4513] border-[#8B4513]'
                : 'bg-[#F8F9FA] border-[#DAC2B6]/60',
            ].join(' ')}
          >
            <Text
              className={[
                'text-[13px] font-bold',
                isSelected ? 'text-white' : 'text-[#3A1F04]',
              ].join(' ')}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
