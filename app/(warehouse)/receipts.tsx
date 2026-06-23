import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '../../services/apiClient';
import {
  getInboundReceiptById,
  getInboundReceiptPdf,
  getInboundReceipts,
  type InboundReceiptDetailDto,
  type InboundReceiptDto,
} from '../../services/inboundApi';
import { useAuthStore } from '../../store/useAuthStore';

export default function WarehouseReceiptsScreen() {
  const token = useAuthStore((state) => state.token);
  const [receipts, setReceipts] = useState<InboundReceiptDto[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<InboundReceiptDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadReceipts = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await getInboundReceipts(token);
      setReceipts(result);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadReceipts();
    }, [loadReceipts])
  );

  const openDetail = async (receiptId: string) => {
    setMessage(null);
    try {
      const detail = await getInboundReceiptById(token, receiptId);
      setSelectedReceipt(detail);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    }
  };

  const openPdf = async (receiptId: string) => {
    await WebBrowser.openBrowserAsync(encodeURI(getInboundReceiptPdf(receiptId)));
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF7F4]" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-[#102A2D]">Receipts</Text>
            <Text className="mt-1 text-xs font-semibold text-[#64748B]">GET /api/Inbound/receipts</Text>
          </View>
          <Pressable onPress={loadReceipts} className="rounded-lg bg-[#0F766E] px-4 py-3">
            <Text className="font-bold text-white">Refresh</Text>
          </Pressable>
        </View>

        {isLoading ? <ActivityIndicator className="my-4" color="#0F766E" /> : null}
        {message ? <Message text={message} /> : null}
        {!isLoading && receipts.length === 0 ? <Message text="No receipts returned by backend." /> : null}

        <View className="gap-3">
          {receipts.map((receipt) => (
            <View key={receipt.receiptId} className="rounded-xl bg-white p-4 shadow-sm">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-base font-bold text-[#102A2D]">{receipt.receiptCode}</Text>
                  <Text className="mt-1 text-xs text-[#64748B]">{receipt.orderId}</Text>
                </View>
                <View className="rounded-full bg-[#DDF5F0] px-3 py-1">
                  <Text className="text-[11px] font-bold text-[#0F766E]">{receipt.status || 'N/A'}</Text>
                </View>
              </View>
              <InfoRow label="Arrival" value={formatDateTime(receipt.arrivalTime)} />
              <InfoRow label="Driver" value={receipt.driverName || 'N/A'} />
              <View className="mt-4 flex-row gap-2">
                <SmallButton icon="eye-outline" label="Detail" onPress={() => openDetail(receipt.receiptId)} />
                <SmallButton icon="open-outline" label="PDF" onPress={() => openPdf(receipt.receiptId)} secondary />
              </View>
            </View>
          ))}
        </View>

        {selectedReceipt ? (
          <View className="mt-5 rounded-xl bg-white p-4 shadow-sm">
            <Text className="text-lg font-bold text-[#102A2D]">Receipt detail</Text>
            <InfoRow label="Code" value={selectedReceipt.receiptCode} />
            <InfoRow label="Status" value={selectedReceipt.status || 'N/A'} />
            <InfoRow label="Order" value={selectedReceipt.orderId} />
            <InfoRow label="Driver" value={selectedReceipt.driverName || 'N/A'} />
            <Text className="mt-4 text-sm font-bold text-[#102A2D]">Items</Text>
            {selectedReceipt.items.length === 0 ? (
              <Text className="mt-2 text-xs text-[#64748B]">No LPN items returned.</Text>
            ) : (
              selectedReceipt.items.map((item) => (
                <View key={item.receiptItemId} className="mt-3 rounded-lg border border-[#D7E5E4] p-3">
                  <Text className="font-bold text-[#102A2D]">{item.itemName}</Text>
                  <InfoRow label="Expected" value={String(item.expectedQuantity)} />
                  <InfoRow label="Actual" value={String(item.actualQuantity)} />
                  <InfoRow label="Condition" value={item.conditionStatus} />
                </View>
              ))
            )}
            <Pressable onPress={() => setSelectedReceipt(null)} className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-[#DDF5F0] px-4 py-3">
              <Ionicons name="close-outline" size={18} color="#0F766E" />
              <Text className="font-bold text-[#0F766E]">Close detail</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SmallButton({
  icon,
  label,
  onPress,
  secondary = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'flex-1 flex-row items-center justify-center gap-2 rounded-lg px-3 py-3',
        secondary ? 'bg-[#DDF5F0]' : 'bg-[#0F766E]',
      ].join(' ')}
    >
      <Ionicons name={icon} size={18} color={secondary ? '#0F766E' : '#FFFFFF'} />
      <Text className={secondary ? 'font-bold text-[#0F766E]' : 'font-bold text-white'}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-2 flex-row gap-2">
      <Text className="w-20 text-xs font-bold text-[#64748B]">{label}</Text>
      <Text className="flex-1 text-xs text-[#102A2D]">{value}</Text>
    </View>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View className="mb-3 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2">
      <Text className="text-xs font-semibold text-[#3730A3]">{text}</Text>
    </View>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
