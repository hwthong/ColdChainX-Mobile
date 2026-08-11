import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../../../constants/colors';

type CreateOrderStepProgressProps = {
  currentStep: number;
  totalSteps: number;
  title: string;
};

export function CreateOrderStepProgress({
  currentStep,
  totalSteps,
  title,
}: CreateOrderStepProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <View style={{ backgroundColor: colors.surface.card, borderBottomColor: colors.border.default }} className="border-b px-5 py-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text style={{ color: colors.brand.primary }} className="text-[11px] font-bold uppercase tracking-[1.4px]">
            Bước {currentStep} trên {totalSteps}
          </Text>
          <Text style={{ color: colors.text.primary }} className="mt-1 text-[17px] font-bold">{title}</Text>
        </View>
        <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">{percentage}%</Text>
      </View>
      <View style={{ backgroundColor: colors.brand.primarySoft }} className="mt-3 h-1.5 w-full overflow-hidden rounded-full">
        <View style={{ width: `${percentage}%`, backgroundColor: colors.brand.primary }} className="h-full rounded-full" />
      </View>
    </View>
  );
}
