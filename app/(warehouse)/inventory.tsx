import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '../../services/apiClient';
import {
  buildInventoryDocumentUrl,
  getInventoryLpns,
  getLpnDocuments,
  type LpnDocumentDto,
  type LpnDto,
  type LpnState,
} from '../../services/inventoryApi';
import { useAuthStore } from '../../store/useAuthStore';

const STATUS_FILTERS: { label: string; value: LpnState | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Receiving', value: 'RECEIVING' },
  { label: 'Hold', value: 'DISCREPANCY_HOLD' },
  { label: 'In stock', value: 'IN_STOCK' },
  { label: 'Return', value: 'RETURN_PENDING' },
];

export default function WarehouseInventoryScreen() {
  const token = useAuthStore((state) => state.token);
  const [lpns, setLpns] = useState<LpnDto[]>([]);
  const [status, setStatus] = useState<LpnState | ''>('IN_STOCK');
  const [keyword, setKeyword] = useState('');
  const [selectedLpn, setSelectedLpn] = useState<LpnDto | null>(null);
  const [documents, setDocuments] = useState<LpnDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadLpns = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await getInventoryLpns(token, {
        status,
        keyword: keyword.trim() || undefined,
      });
      setLpns(result);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [keyword, status, token]);

  useFocusEffect(
    useCallback(() => {
      loadLpns();
    }, [loadLpns])
  );

  const openLpn = async (lpn: LpnDto) => {
    setSelectedLpn(lpn);
    setDocuments([]);
    setMessage(null);

    try {
      const response = await getLpnDocuments(token, lpn.lpnId);
      if (response.success) {
        setDocuments(response.data ?? []);
      } else {
        setMessage(response.message || 'Unable to load LPN documents.');
      }
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    }
  };

  const openDocument = async (url: string) => {
    await WebBrowser.openBrowserAsync(encodeURI(buildInventoryDocumentUrl(url)));
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF7F4]" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <View className="mb-4">
          <Text className="text-2xl font-bold text-[#102A2D]">Inventory LPNs</Text>
          <Text className="mt-1 text-xs font-semibold text-[#64748B]">GET /api/Inventory/lpns</Text>
        </View>

        <View className="rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-xs font-bold text-[#36514D]">Search</Text>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="LPN code or item name"
            placeholderTextColor="#94A3B8"
            className="mt-1 rounded-lg border border-[#D7E5E4] px-3 py-2 text-sm text-[#102A2D]"
          />
          <View className="mt-3 flex-row flex-wrap gap-2">
            {STATUS_FILTERS.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => setStatus(item.value)}
                className={['rounded-lg px-3 py-2', status === item.value ? 'bg-[#0F766E]' : 'bg-[#DDF5F0]'].join(' ')}
              >
                <Text className={status === item.value ? 'text-xs font-bold text-white' : 'text-xs font-bold text-[#0F766E]'}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={loadLpns} className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-[#0F766E] px-4 py-3">
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text className="font-bold text-white">Refresh inventory</Text>
          </Pressable>
        </View>

        {isLoading ? <ActivityIndicator className="my-4" color="#0F766E" /> : null}
        {message ? <Message text={message} /> : null}
        {!isLoading && lpns.length === 0 ? <Message text="No LPNs returned by backend for this filter." /> : null}

        <View className="mt-4 gap-3">
          {lpns.map((lpn) => (
            <Pressable key={lpn.lpnId} onPress={() => openLpn(lpn)} className="rounded-xl bg-white p-4 shadow-sm">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-base font-bold text-[#102A2D]">{lpn.lpnCode}</Text>
                  <Text className="mt-1 text-xs text-[#64748B]">{lpn.itemName}</Text>
                </View>
                <View className="rounded-full bg-[#DDF5F0] px-3 py-1">
                  <Text className="text-[11px] font-bold text-[#0F766E]">{lpn.state}</Text>
                </View>
              </View>
              <InfoRow label="Qty" value={String(lpn.quantity)} />
              <InfoRow label="Weight" value={`${lpn.actualWeightKg} / ${lpn.expectedWeightKg} kg`} />
              <InfoRow label="Location" value={lpn.storageLocation || 'N/A'} />
              <InfoRow label="Inbound" value={formatDateTime(lpn.inboundTime)} />
              {lpn.condition ? <InfoRow label="Condition" value={lpn.condition} /> : null}
            </Pressable>
          ))}
        </View>

        {selectedLpn ? (
          <View className="mt-5 rounded-xl bg-white p-4 shadow-sm">
            <Text className="text-lg font-bold text-[#102A2D]">{selectedLpn.lpnCode}</Text>
            <InfoRow label="State" value={selectedLpn.state} />
            <InfoRow label="Location" value={selectedLpn.storageLocation || 'N/A'} />
            <InfoRow label="SLA" value={formatDateTime(selectedLpn.slaDeadline)} />
            <Text className="mt-4 text-sm font-bold text-[#102A2D]">Documents</Text>
            {documents.length === 0 ? (
              <Text className="mt-2 text-xs text-[#64748B]">No documents returned for this LPN.</Text>
            ) : (
              documents.map((doc) => (
                <Pressable
                  key={`${doc.documentType}-${doc.url}`}
                  onPress={() => openDocument(doc.url)}
                  className="mt-3 flex-row items-center gap-3 rounded-lg border border-[#D7E5E4] p-3"
                >
                  <Ionicons name="document-attach-outline" size={20} color="#0F766E" />
                  <View className="flex-1">
                    <Text className="font-bold text-[#102A2D]">{doc.documentName}</Text>
                    <Text className="mt-1 text-xs text-[#64748B]">{doc.documentType}</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color="#0F766E" />
                </Pressable>
              ))
            )}
            <Pressable onPress={() => setSelectedLpn(null)} className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-[#DDF5F0] px-4 py-3">
              <Ionicons name="close-outline" size={18} color="#0F766E" />
              <Text className="font-bold text-[#0F766E]">Close detail</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    <View className="mt-3 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2">
      <Text className="text-xs font-semibold text-[#3730A3]">{text}</Text>
    </View>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
