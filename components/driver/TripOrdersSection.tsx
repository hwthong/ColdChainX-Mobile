import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';

import { AppPressable as Pressable } from '../AppPressable';
import { colors } from '../../constants/colors';
import type { OrderResponse } from '../../services/orderApi';
import type { TrackingOrderDto, TripRouteResponse } from '../../services/trackingApi';

const ORDER_STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  PENDING_REVIEW: { label: 'Chờ duyệt', bg: colors.surface.selected, text: colors.brand.primary },
  APPROVED: { label: 'Đã duyệt', bg: colors.status.info.bg, text: colors.status.info.main },
  DISPATCHED: { label: 'Đã điều phối', bg: colors.status.info.bg, text: colors.status.info.main },
  IN_TRANSIT: { label: 'Đang vận chuyển', bg: colors.status.info.bg, text: colors.status.info.main },
  DELIVERED: { label: 'Đã giao', bg: colors.status.success.bg, text: colors.status.success.main },
  COMPLETED: { label: 'Hoàn tất', bg: colors.status.success.bg, text: colors.status.success.main },
  PARTIALLY_DELIVERED: { label: 'Giao 1 phần', bg: colors.status.warning.bg, text: colors.status.warning.main },
  RETURNED: { label: 'Hoàn trả', bg: colors.status.danger.bg, text: colors.status.danger.main },
  CANCELLED: { label: 'Đã hủy', bg: colors.status.danger.bg, text: colors.status.danger.main },
};

function formatTemp(temp?: string | number | null): string | null {
  if (temp === undefined || temp === null || temp === '') return null;
  const str = String(temp).trim();
  if (!str) return null;
  if (str.includes('°C') || str.includes('°')) return str;
  const num = Number(str);
  if (!Number.isNaN(num)) return `${num > 0 ? `+${num}` : num}°C`;
  return str;
}

interface StopGroupItem {
  orderId: string;
  trackingCode: string;
  itemName: string;
  quantity?: number | null;
  tempCondition?: string | null;
}

interface StopGroup {
  stopKey: string;
  stopSequence: number;
  stopAddress: string;
  orders: StopGroupItem[];
}

interface Props {
  route: TripRouteResponse | null;
  fallbackOrders?: TrackingOrderDto[];
  orderDetailsMap: Record<string, OrderResponse>;
  loadingDetails: boolean;
}

export function TripOrdersSection({
  route,
  fallbackOrders,
  orderDetailsMap,
  loadingDetails,
}: Props) {
  const stopGroups = useMemo<StopGroup[]>(() => {
    if (!route?.optimizedStops?.length) {
      if (fallbackOrders?.length) {
        return [
          {
            stopKey: 'fallback-all',
            stopSequence: 1,
            stopAddress: 'Tất cả điểm giao trong chuyến',
            orders: fallbackOrders.map((o) => ({
              orderId: o.orderId,
              trackingCode: o.trackingCode,
              itemName: o.itemName,
              quantity: undefined,
              tempCondition: o.tempCondition,
            })),
          },
        ];
      }
      return [];
    }

    const groups: StopGroup[] = [];
    const seenOrderIds = new Set<string>();

    route.optimizedStops.forEach((stop, index) => {
      const stopOrders = (stop.orders ?? []).filter((order) => {
        if (!order.orderId) return false;
        if (seenOrderIds.has(order.orderId)) return false;
        seenOrderIds.add(order.orderId);
        return true;
      });

      if (stopOrders.length > 0) {
        groups.push({
          stopKey: stop.stopId || `stop-${index}`,
          stopSequence: stop.optimizedSequence ?? stop.originalStopSequence ?? index + 1,
          stopAddress: stop.address || `Điểm dừng ${index + 1}`,
          orders: stopOrders.map((o) => ({
            orderId: o.orderId,
            trackingCode: o.trackingCode,
            itemName: o.itemName,
            quantity: o.quantity,
            tempCondition: o.tempCondition,
          })),
        });
      }
    });

    return groups;
  }, [route, fallbackOrders]);

  const totalOrders = useMemo(() => {
    return stopGroups.reduce((acc, g) => acc + g.orders.length, 0);
  }, [stopGroups]);

  return (
    <View
      style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
      className="gap-4 rounded-3xl border p-5 shadow-sm"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="cube-outline" size={20} color={colors.brand.primary} />
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">
            Đơn hàng trong chuyến
          </Text>
        </View>
        {totalOrders > 0 ? (
          <View
            style={{ backgroundColor: colors.surface.muted }}
            className="rounded-full px-3 py-1"
          >
            <Text style={{ color: colors.text.primary }} className="text-xs font-bold">
              {totalOrders}
            </Text>
          </View>
        ) : null}
      </View>

      {totalOrders === 0 ? (
        <Text style={{ color: colors.text.secondary }} className="py-3 text-center text-sm font-medium">
          Chuyến xe chưa có đơn hàng.
        </Text>
      ) : (
        <View className="gap-4">
          {stopGroups.map((group) => (
            <View key={group.stopKey} className="gap-2.5">
              <View className="flex-row items-center gap-2">
                <View
                  style={{ backgroundColor: colors.brand.primarySoft }}
                  className="h-6 px-2 rounded-full items-center justify-center"
                >
                  <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">
                    Điểm {group.stopSequence}
                  </Text>
                </View>
                <Text
                  style={{ color: colors.text.secondary }}
                  className="flex-1 text-xs font-medium"
                  numberOfLines={1}
                >
                  {group.stopAddress}
                </Text>
              </View>

              {group.orders.map((order) => {
                const orderId = (order.orderId || '').trim();
                const detail =
                  orderDetailsMap[orderId] ||
                  orderDetailsMap[orderId.toLowerCase()] ||
                  orderDetailsMap[orderId.toUpperCase()];
                const customerName =
                  detail?.customerName ||
                  (detail as unknown as { CustomerName?: string })?.CustomerName ||
                  (detail as unknown as { customer?: { companyName?: string } })?.customer?.companyName ||
                  (detail as unknown as { Customer?: { CompanyName?: string } })?.Customer?.CompanyName;
                const rawStatus = detail?.status || (detail as unknown as { Status?: string })?.Status;
                const statusConfig = rawStatus ? ORDER_STATUS_MAP[rawStatus.toUpperCase()] : null;
                const displayStatus = rawStatus
                  ? (statusConfig ?? {
                      label: rawStatus,
                      bg: colors.surface.selected,
                      text: colors.brand.primary,
                    })
                  : null;

                const packing = detail?.packingType ? ` ${detail.packingType}` : ' kiện';
                const quantity = detail?.quantity ?? order.quantity;
                const cargoName = detail?.itemName || order.itemName || 'Hàng hóa';
                const cargoText = quantity != null ? `${cargoName} · ${quantity}${packing}` : cargoName;

                const tempText = formatTemp(detail?.tempCondition ?? order.tempCondition);

                const customerContactName =
                  detail?.customerContactName ||
                  (detail as unknown as { CustomerContactName?: string })?.CustomerContactName ||
                  detail?.receiverName ||
                  (detail as unknown as { ReceiverName?: string })?.ReceiverName;

                const customerPhone =
                  detail?.customerPhone ||
                  (detail as unknown as { CustomerPhone?: string })?.CustomerPhone ||
                  detail?.receiverPhone ||
                  (detail as unknown as { ReceiverPhone?: string })?.ReceiverPhone ||
                  (detail as unknown as { phone?: string })?.phone ||
                  (detail as unknown as { Phone?: string })?.Phone;

                return (
                  <View
                    key={order.orderId}
                    style={{
                      backgroundColor: colors.surface.muted,
                      borderColor: colors.border.default,
                    }}
                    className="rounded-2xl border p-4 gap-2.5"
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <Text
                        style={{ color: colors.brand.primary }}
                        className="text-sm font-bold tracking-wider"
                      >
                        {order.trackingCode || detail?.trackingCode || 'Đơn hàng'}
                      </Text>
                      {displayStatus ? (
                        <View
                          style={{ backgroundColor: displayStatus.bg }}
                          className="rounded-md px-2 py-0.5"
                        >
                          <Text
                            style={{ color: displayStatus.text }}
                            className="text-[10px] font-bold"
                          >
                            {displayStatus.label}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-row items-start gap-2 flex-1">
                        <Ionicons
                          name="business-outline"
                          size={15}
                          color={colors.text.secondary}
                          style={{ marginTop: 2 }}
                        />
                        <View className="flex-1">
                          <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                            Khách hàng
                          </Text>
                          {customerName ? (
                            <Text
                              style={{ color: colors.text.primary }}
                              className="mt-0.5 text-sm font-bold"
                            >
                              {customerName}
                            </Text>
                          ) : loadingDetails ? (
                            <View className="flex-row items-center gap-1.5 mt-0.5">
                              <ActivityIndicator size="small" color={colors.brand.primary} />
                              <Text style={{ color: colors.text.muted }} className="text-xs italic">
                                Đang tải thông tin khách hàng...
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ color: colors.text.secondary }} className="mt-0.5 text-xs italic">
                              Chưa có thông tin khách hàng
                            </Text>
                          )}

                          {customerContactName ? (
                            <View className="flex-row items-center gap-1.5 mt-1">
                              <Ionicons name="person-outline" size={12} color={colors.text.secondary} />
                              <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                                {customerContactName}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {customerPhone ? (
                        <Pressable
                          onPress={() => Linking.openURL(`tel:${customerPhone.replace(/\s+/g, '')}`)}
                          style={{
                            backgroundColor: colors.brand.primarySoft,
                          }}
                          className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full self-start"
                        >
                          <Ionicons name="call" size={12} color={colors.brand.primary} />
                          <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">
                            {customerPhone}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View
                      style={{ borderTopColor: colors.border.default }}
                      className="flex-row items-center justify-between border-t pt-2 mt-0.5"
                    >
                      <View className="flex-1 flex-row items-center gap-1.5 mr-2">
                        <Ionicons name="cube-outline" size={14} color={colors.text.secondary} />
                        <Text
                          style={{ color: colors.text.primary }}
                          className="text-xs font-medium flex-shrink"
                          numberOfLines={1}
                        >
                          {cargoText}
                        </Text>
                      </View>

                      {tempText ? (
                        <View
                          style={{
                            backgroundColor: colors.surface.card,
                            borderColor: colors.border.default,
                          }}
                          className="flex-row items-center gap-1 rounded-lg border px-2 py-0.5"
                        >
                          <Ionicons name="snow-outline" size={11} color={colors.brand.primary} />
                          <Text
                            style={{ color: colors.brand.primary }}
                            className="text-xs font-bold"
                          >
                            {tempText}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
