import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { API_BASE_URL } from '../services/apiClient';
import type { AsnResponse } from '../services/asnApi';
import { LocalQrCode } from './local-qr-code';

interface AsnResultCardProps {
  asn: AsnResponse;
  warehouseName?: string | null;
  trackingCode?: string | null;
  itemName?: string | null;
}

export function AsnResultCard({ asn, warehouseName, trackingCode, itemName }: AsnResultCardProps) {
  const [showTechDetails, setShowTechDetails] = useState(false);
  const fileUrl = getFullAssetUrl(asn.fileUrl);
  const statusMeta = translateAsnStatus(asn.status);

  return (
    <View
      style={{
        backgroundColor: colors.surface.card,
        borderColor: colors.border.default,
      }}
      className="gap-5 overflow-hidden rounded-3xl border p-5 shadow-sm"
    >
      {/* ── Header: Pass Title & Status ── */}
      <View className="flex-row items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="document-text" size={16} color={colors.brand.primary} />
            <Text style={{ color: colors.brand.primary }} className="text-xs font-bold uppercase tracking-wider">
              Phiếu hẹn giao kho (ASN)
            </Text>
          </View>
          <Text selectable style={{ color: colors.text.primary }} className="mt-1 text-xl font-extrabold">
            {asn.asnCode}
          </Text>
        </View>

        <View className={`rounded-full px-3.5 py-1.5 ${statusMeta.bg}`}>
          <Text className={`text-xs font-bold uppercase tracking-wider ${statusMeta.color}`}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* ── QR Code Section (Boarding Pass Style) ── */}
      <View className="items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
        <View className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <LocalQrCode value={asn.qrCodeValue} size={170} />
        </View>
        <Text style={{ color: colors.text.secondary }} className="mt-3 text-center text-xs font-medium leading-4">
          Xuất trình mã QR này tại cổng kho để nhân viên quét nhận hàng nhanh
        </Text>
      </View>

      {/* ── Main Information Rows ── */}
      <View className="gap-2.5">
        <InfoRow
          icon="business-outline"
          label="Kho tiếp nhận"
          value={warehouseName || asn.warehouseName || 'Kho trung chuyển ColdChainX'}
          subValue={asn.warehouseAddress || undefined}
          strong
        />
        <InfoRow
          icon="time-outline"
          label="Thời gian hẹn giao kho"
          value={formatDateTime(asn.requestedDropoffTime)}
          strong
        />
        <InfoRow
          icon="timer-outline"
          label="Hạn chót tiếp nhận (Cut-off)"
          value={formatCutOffTime(asn.cutOffTime)}
        />
        <InfoRow
          icon="barcode-outline"
          label="Mã đơn hàng"
          value={trackingCode || (asn.orderId ? `Đơn #${asn.orderId.slice(0, 8).toUpperCase()}` : 'Chưa cập nhật')}
        />
        {itemName ? (
          <InfoRow
            icon="cube-outline"
            label="Hàng hóa"
            value={itemName}
          />
        ) : null}
        <InfoRow
          icon="git-branch-outline"
          label="Tuyến vận chuyển"
          value={asn.routeCode || asn.routeId || 'Theo hợp đồng'}
        />
        {asn.phone ? (
          <InfoRow
            icon="call-outline"
            label="SĐT liên hệ giao hàng"
            value={asn.phone}
          />
        ) : null}
        <InfoRow
          icon="calendar-outline"
          label="Thời gian tạo phiếu"
          value={formatDateTime(asn.createdAt)}
        />
      </View>

      {/* ── Action: Open File ASN ── */}
      {fileUrl ? (
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(encodeURI(fileUrl))}
          style={{ backgroundColor: colors.brand.primary }}
          className="flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3.5 shadow-sm"
        >
          <Ionicons name="document-text-outline" size={18} color={colors.text.onPrimary} />
          <Text style={{ color: colors.text.onPrimary }} className="font-bold">
            Mở file phiếu xác nhận (PDF)
          </Text>
        </Pressable>
      ) : null}

      {/* ── Optional Technical Details Toggle ── */}
      <View className="border-t border-slate-100 pt-2">
        <Pressable
          onPress={() => setShowTechDetails((prev) => !prev)}
          className="flex-row items-center justify-center gap-1.5 py-1.5"
        >
          <Text style={{ color: colors.text.muted }} className="text-xs font-semibold">
            {showTechDetails ? 'Thu gọn mã kỹ thuật' : 'Xem mã kỹ thuật (Tra cứu)'}
          </Text>
          <Ionicons
            name={showTechDetails ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.text.muted}
          />
        </Pressable>

        {showTechDetails ? (
          <View style={{ backgroundColor: colors.surface.muted }} className="mt-2 gap-1.5 rounded-xl p-3">
            <Text selectable style={{ color: colors.text.muted }} className="text-[11px]">
              Mã ASN (GUID): {asn.asnId}
            </Text>
            <Text selectable style={{ color: colors.text.muted }} className="text-[11px]">
              Mã Order (GUID): {asn.orderId}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  subValue,
  strong = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
  subValue?: string | null;
  strong?: boolean;
}) {
  return (
    <View style={{ backgroundColor: colors.surface.muted }} className="rounded-2xl px-4 py-3">
      <View className="flex-row items-center gap-1.5">
        {icon ? <Ionicons name={icon} size={14} color={colors.text.secondary} /> : null}
        <Text style={{ color: colors.text.secondary }} className="text-[11px] font-bold uppercase tracking-wider">
          {label}
        </Text>
      </View>
      <Text
        selectable
        style={{ color: colors.text.primary }}
        className={`mt-1 text-sm leading-5 ${strong ? 'font-bold' : 'font-semibold'}`}
      >
        {value || 'Chưa cập nhật'}
      </Text>
      {subValue ? (
        <Text selectable style={{ color: colors.text.secondary }} className="mt-0.5 text-xs leading-4">
          {subValue}
        </Text>
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

function translateAsnStatus(status?: string | null): { label: string; color: string; bg: string } {
  switch ((status || '').toUpperCase()) {
    case 'SCHEDULED':
      return { label: 'Đã đặt lịch hẹn', color: 'text-blue-700', bg: 'bg-blue-100' };
    case 'ARRIVED':
    case 'CHECKED_IN':
      return { label: 'Đã đến cổng kho', color: 'text-amber-700', bg: 'bg-amber-100' };
    case 'QC_PASSED':
      return { label: 'QC đạt chuẩn', color: 'text-emerald-700', bg: 'bg-emerald-100' };
    case 'QC_FAILED':
      return { label: 'QC không đạt', color: 'text-red-700', bg: 'bg-red-100' };
    case 'DISCREPANCY_HOLD':
      return { label: 'Chờ xử lý lệch', color: 'text-orange-700', bg: 'bg-orange-100' };
    case 'RECEIVED':
    case 'COMPLETED':
      return { label: 'Đã nhập kho thành công', color: 'text-emerald-700', bg: 'bg-emerald-100' };
    case 'CANCELLED':
      return { label: 'Đã hủy lịch', color: 'text-slate-700', bg: 'bg-slate-100' };
    default:
      return { label: status || 'Đã đặt lịch', color: 'text-slate-700', bg: 'bg-slate-100' };
  }
}

