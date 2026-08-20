import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { API_BASE_URL } from '../services/apiClient';
import type { AsnResponse } from '../services/asnApi';
import { LocalQrCode } from './local-qr-code';

type AsnResultCardProps = {
  asn: AsnResponse;
  warehouseName?: string | null;
};

export function AsnResultCard({ asn }: AsnResultCardProps) {
  const fileUrl = getFullAssetUrl(asn.fileUrl);

  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-5 rounded-3xl border p-5 shadow-sm">
      <View className="items-center">
        <LocalQrCode value={asn.qrCodeValue} />
      </View>

      {fileUrl ? (
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(encodeURI(fileUrl))}
          style={{ backgroundColor: colors.brand.primary }}
          className="flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3"
        >
          <Ionicons name="document-text-outline" size={18} color={colors.text.onPrimary} />
          <Text style={{ color: colors.text.onPrimary }} className="font-bold">Mở thẻ ASN</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function getFullAssetUrl(rawUrl?: string | null) {
  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith('http')) {
    return rawUrl;
  }

  return `${API_BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}
