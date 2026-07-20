import React from 'react';
import { View, Text } from 'react-native';

export interface TemperaturePoint {
  timestamp: string;
  tempC: number;
}

export function TemperatureChart({ points }: { points: TemperaturePoint[] }) {
  if (!points || points.length === 0) {
    return (
      <View className="h-32 bg-slate-50 rounded-xl justify-center items-center">
        <Text className="text-slate-500">Chưa có dữ liệu nhiệt độ.</Text>
      </View>
    );
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN');
    } catch {
      return isoString;
    }
  };

  return (
    <View className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <View className="p-3 bg-slate-50 border-b border-slate-200 flex-row justify-between">
        <Text className="font-semibold text-slate-700">Thống kê Dữ liệu</Text>
        <Text className="text-sm text-slate-500">{points.length} điểm</Text>
      </View>
      <View className="p-4 gap-2">
        <View className="flex-row justify-between items-center">
          <Text className="text-sm text-slate-500">Bắt đầu:</Text>
          <Text className="text-sm font-medium text-slate-700">{formatTime(firstPoint.timestamp)}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-sm text-slate-500">Nhiệt độ đầu:</Text>
          <Text className="text-sm font-medium text-slate-700">{firstPoint.tempC.toFixed(1)} °C</Text>
        </View>
        <View className="h-[1px] bg-slate-100 my-1" />
        <View className="flex-row justify-between items-center">
          <Text className="text-sm text-slate-500">Mới nhất:</Text>
          <Text className="text-sm font-medium text-slate-700">{formatTime(lastPoint.timestamp)}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-sm text-slate-500">Nhiệt độ cuối:</Text>
          <Text className="text-sm font-medium text-slate-700">{lastPoint.tempC.toFixed(1)} °C</Text>
        </View>
      </View>
    </View>
  );
}
