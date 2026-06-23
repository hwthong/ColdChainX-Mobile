import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

type QrCodeInstance = {
  addData: (data: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
};

type QrCodeConstructor = new (typeNumber: number, errorCorrectLevel: number) => QrCodeInstance;

type ErrorCorrectLevel = {
  L: number;
  M: number;
  Q: number;
  H: number;
};

declare const require: <T>(moduleName: string) => T;

const QRCode = require<QrCodeConstructor>('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require<ErrorCorrectLevel>('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

type LocalQrCodeProps = {
  value?: string | null;
  size?: number;
};

export function LocalQrCode({ value, size = 220 }: LocalQrCodeProps) {
  const matrix = useMemo(() => createQrMatrix(value), [value]);

  if (!value || matrix.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-2xl border border-dashed border-[#DAC2B6] bg-white"
        style={{ width: size, height: size }}
      >
        <Text className="px-4 text-center text-xs font-semibold text-[#877369]">Chưa có dữ liệu QR</Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-2xl border border-[#E8D8CF] bg-white p-3"
      style={{ width: size, height: size }}
    >
      <View className="flex-1 bg-white">
        {matrix.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} className="flex-1 flex-row">
            {row.map((isDark, colIndex) => (
              <View
                key={`${rowIndex}-${colIndex}`}
                className="flex-1"
                style={{ backgroundColor: isDark ? '#111827' : '#FFFFFF' }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function createQrMatrix(value?: string | null) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const qrCode = new QRCode(-1, QRErrorCorrectLevel.M);
    qrCode.addData(value.trim());
    qrCode.make();

    const moduleCount = qrCode.getModuleCount();
    const quietZone = 4;
    const matrixSize = moduleCount + quietZone * 2;

    return Array.from({ length: matrixSize }, (_, rowIndex) =>
      Array.from({ length: matrixSize }, (_, colIndex) => {
        const row = rowIndex - quietZone;
        const col = colIndex - quietZone;

        if (row < 0 || col < 0 || row >= moduleCount || col >= moduleCount) {
          return false;
        }

        return qrCode.isDark(row, col);
      })
    );
  } catch (error) {
    console.warn('[LocalQrCode] Could not generate QR matrix', error);
    return [];
  }
}
