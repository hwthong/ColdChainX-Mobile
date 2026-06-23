import React from 'react';
import { View, Text } from 'react-native';

import { getStatusStyle } from '../constants/warehouseTheme';

interface StatusBadgeProps {
  /** Raw status code (e.g. 'IN_STOCK', 'RECEIVING', 'DISCREPANCY_HOLD') */
  status: string;
  /** If true, shows the Vietnamese label instead of the raw code */
  showVietnameseLabel?: boolean;
}

/**
 * Dynamic status badge with color-coded background based on status code.
 * Reused across inbound, receipts, and inventory screens.
 */
export function StatusBadge({ status, showVietnameseLabel = false }: StatusBadgeProps) {
  const style = getStatusStyle(status);

  return (
    <View
      style={{
        backgroundColor: style.bg,
        borderWidth: 1,
        borderColor: style.border,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: style.text }}>
        {showVietnameseLabel ? style.label : status}
      </Text>
    </View>
  );
}
