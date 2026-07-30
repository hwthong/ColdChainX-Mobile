import React from 'react';
import { Text, View } from 'react-native';

type CreateOrderStepProgressProps = {
  currentStep: number;
  totalSteps: number;
  title: string;
  subtitle: string;
};

export function CreateOrderStepProgress({ currentStep, totalSteps, title, subtitle }: CreateOrderStepProgressProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Bước ${currentStep} trên ${totalSteps}: ${title}`}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
      className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-4"
    >
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#8B4513]">Bước {currentStep}/{totalSteps}</Text>
          <Text className="mt-1 text-lg font-bold text-[#3A1F04]">{title}</Text>
          <Text className="mt-1 text-sm leading-5 text-[#877369]">{subtitle}</Text>
        </View>
        <Text className="text-sm font-bold text-[#8B4513]">{currentStep * 25}%</Text>
      </View>
      <View className="mt-4 flex-row gap-1.5">
        {Array.from({ length: totalSteps }, (_, index) => {
          const step = index + 1;
          const isCurrent = step === currentStep;
          const isComplete = step < currentStep;
          return (
            <View
              key={step}
              accessibilityLabel={isComplete ? `Bước ${step} đã hoàn thành` : isCurrent ? `Bước ${step} hiện tại` : `Bước ${step} chưa thực hiện`}
              className={[
                'h-1.5 flex-1 rounded-full',
                isCurrent || isComplete ? 'bg-[#8B4513]' : 'bg-[#F1E6DF]',
              ].join(' ')}
            />
          );
        })}
      </View>
    </View>
  );
}
