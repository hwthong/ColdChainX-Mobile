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

export function AsnResultCard({ asn, warehouseName }: AsnResultCardProps) {
  const fileUrl = getFullAssetUrl(asn.fileUrl);

  return (
    <View style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }} className="gap-4 rounded-3xl border p-5 shadow-sm">
      <View className="items-center gap-3">
        <View className="rounded-full bg-green-100 px-4 py-1.5">
          <Text className="text-xs font-bold uppercase tracking-wider text-green-700">
            {translateAsnStatus(asn.status)}
          </Text>
        </View>
        <Text selectable style={{ color: colors.brand.primary }} className="text-center text-2xl font-extrabold">
          {asn.asnCode}
        </Text>
        <LocalQrCode value={asn.qrCodeValue} />
      </View>

      <View className="gap-2">
        <InfoRow label="ASN ID" value={asn.asnId} />
        <InfoRow label="Order ID" value={asn.orderId} />
        <InfoRow label="Route" value={asn.routeCode || asn.routeId} />
        <InfoRow label="Kho nhận" value={warehouseName || 'Chưa xác định'} />
        <InfoRow label="Giờ giao kho" value={formatDateTime(asn.requestedDropoffTime)} />
        <InfoRow label="Cut-off" value={formatCutOffTime(asn.cutOffTime)} />
        <InfoRow label="SĐT" value={asn.phone || 'Không có'} />
        <InfoRow label="QR value" value={asn.qrCodeValue} />
        <InfoRow label="Tạo lúc" value={formatDateTime(asn.createdAt)} />
      </View>

      {fileUrl ? (
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(encodeURI(fileUrl))}
          style={{ backgroundColor: colors.brand.primary }}
          className="flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3"
        >
          <Ionicons name="document-text-outline" size={18} color={colors.text.onPrimary} />
          <Text style={{ color: colors.text.onPrimary }} className="font-bold">Mở file ASN</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ backgroundColor: colors.surface.muted }} className="rounded-2xl px-4 py-3">
      <Text style={{ color: colors.text.secondary }} className="text-[11px] font-bold uppercase tracking-wider">{label}</Text>
      <Text selectable style={{ color: colors.text.primary }} className="mt-1 text-sm font-semibold leading-5">
        {value || 'Chưa cập nhật'}
      </Text>
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

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
}

function formatCutOffTime(value?: string | null) {
  if (!value) {
    return 'Chưa cập nhật';
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return value;
  }

  return formatDateTime(value);
}

function translateAsnStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'SCHEDULED':
      return 'Đã đặt lịch';
    case 'QC_PASSED':
      return 'QC đạt';
    case 'DISCREPANCY_HOLD':
      return 'Chờ xử lý lệch';
    default:
      return status;
  }
}
