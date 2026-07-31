import React from 'react';
import { Text, View } from 'react-native';

import { customerColors } from '../../../constants/customerTheme';
type CreateOrderStepProgressProps = {
  currentStep: number;
  totalSteps: number;
  title: string;
};

export function CreateOrderStepProgress({ currentStep, totalSteps, title }: CreateOrderStepProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Bước ${currentStep} trên ${totalSteps}: ${title}`}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
      className="gap-3 px-0.5 py-1"
    >
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-[1.4px] text-[#8B4513]">
            Bước {currentStep} trên {totalSteps}
          </Text>
          <Text className="mt-1 text-[17px] font-bold text-[#3A1F04]">{title}</Text>
        </View>
        <Text className="text-sm font-bold text-[#8B4513]">{percentage}%</Text>
      </View>
      <View
        className="overflow-hidden"
        style={{ backgroundColor: customerColors.progressTrack, height: 6, borderRadius: 999 }}
      >
        <View
          style={{ backgroundColor: customerColors.primary, width: `${percentage}%`, height: 6, borderRadius: 999 }}
        />
      </View>
    </View>
  );
}
