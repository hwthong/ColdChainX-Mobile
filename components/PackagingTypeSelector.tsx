import React from 'react';
import { Pressable, Text, View } from 'react-native';

const PACKAGING_OPTIONS = [
  'Thùng carton',
  'Thùng xốp giữ nhiệt',
  'Thùng nhựa',
  'Túi giữ nhiệt',
  'Pallet',
  'Bao bì hút chân không',
  'Khay nhựa',
  'Khác',
];

interface PackagingTypeSelectorProps {
  selectedTypes: string[];
  onChange: (selected: string[]) => void;
}

export function PackagingTypeSelector({ selectedTypes, onChange }: PackagingTypeSelectorProps) {
  const toggleOption = (option: string) => {
    if (selectedTypes.includes(option)) {
      onChange(selectedTypes.filter((t) => t !== option));
    } else {
      onChange([...selectedTypes, option]);
    }
  };

  return (
    <View className="flex-row flex-wrap gap-2 mt-2">
      {PACKAGING_OPTIONS.map((option) => {
        const isSelected = selectedTypes.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => toggleOption(option)}
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
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
