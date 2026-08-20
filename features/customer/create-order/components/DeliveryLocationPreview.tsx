import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoongRouteMap } from '../../../../components/customer/GoongRouteMap';
import { colors } from '../../../../constants/colors';
import type { GoongPlaceDetail } from '../../../../services/goongPlacesApi';
import type { TripRouteResponse } from '../../../../services/trackingApi';

type DeliveryLocationPreviewProps = {
  location: GoongPlaceDetail;
};

export function DeliveryLocationPreview({ location }: DeliveryLocationPreviewProps) {
  const insets = useSafeAreaInsets();
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const mapRoute = useMemo<TripRouteResponse>(() => ({
    tripId: `delivery-${location.placeId}`,
    overviewPolyline: null,
    totalDistanceMeters: 0,
    totalDurationSeconds: 0,
    origin: null,
    destination: {
      locationId: location.placeId,
      address: location.address,
      lat: location.latitude,
      lon: location.longitude,
    },
    waypointOrder: [],
    optimizedStops: [],
  }), [location]);

  const safeOpenURL = useCallback(async (primaryUrl: string, fallbackUrl?: string) => {
    try {
      const supported = await Linking.canOpenURL(primaryUrl);
      if (supported) {
        await Linking.openURL(primaryUrl);
        return;
      }
    } catch {
      // Try the browser-compatible fallback below.
    }

    if (fallbackUrl) {
      try {
        const fallbackSupported = await Linking.canOpenURL(fallbackUrl);
        if (fallbackSupported) {
          await Linking.openURL(fallbackUrl);
          return;
        }
      } catch {
        // Continue to the final attempt below.
      }
    }

    try {
      await Linking.openURL(fallbackUrl || primaryUrl);
    } catch {
      Alert.alert(
        'Thông báo',
        'Không thể mở ứng dụng bản đồ trên thiết bị. Vui lòng kiểm tra ứng dụng bản đồ hoặc kết nối mạng.'
      );
    }
  }, []);

  const openGoogleMaps = useCallback(async () => {
    const destination = `${location.latitude},${location.longitude}`;
    await safeOpenURL(
      `comgooglemaps://?daddr=${destination}&directionsmode=driving`,
      `https://www.google.com/maps/dir/?api=1&destination=${destination}`
    );
  }, [location.latitude, location.longitude, safeOpenURL]);

  const openAppleMaps = useCallback(async () => {
    const destination = `${location.latitude},${location.longitude}`;
    await safeOpenURL(
      `maps://?daddr=${destination}&dirflg=d`,
      `https://maps.apple.com/?daddr=${destination}`
    );
  }, [location.latitude, location.longitude, safeOpenURL]);

  const openGoongMap = useCallback(async () => {
    const destination = `${location.latitude},${location.longitude}`;
    await safeOpenURL(`https://maps.goong.io/?destination=${destination}`);
  }, [location.latitude, location.longitude, safeOpenURL]);

  return (
    <>
      <View
        accessibilityLabel={`Vị trí giao hàng đã chọn: ${location.address}`}
        style={{ backgroundColor: colors.surface.card, borderColor: colors.border.default }}
        className="gap-4 rounded-3xl border p-5 shadow-sm"
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-2">
            <Ionicons name="map-outline" size={20} color={colors.brand.primary} />
            <Text style={{ color: colors.text.primary }} className="text-base font-bold">
              Bản đồ vị trí giao hàng
            </Text>
          </View>
          <Pressable
            onPress={() => setIsMapFullscreen(true)}
            accessibilityRole="button"
            accessibilityLabel="Phóng to bản đồ vị trí giao hàng"
            style={{ backgroundColor: colors.brand.primarySoft }}
            className="flex-row items-center gap-1 rounded-lg px-2.5 py-1"
          >
            <Ionicons name="expand-outline" size={13} color={colors.brand.primary} />
            <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">
              Phóng to
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-start gap-2.5 rounded-2xl bg-emerald-50 px-3.5 py-3">
          <Ionicons name="checkmark-circle" size={19} color="#15803D" />
          <View className="flex-1">
            <Text className="text-xs font-bold text-emerald-800">Đã định vị địa chỉ giao hàng</Text>
            <Text className="mt-0.5 text-[11px] leading-4 text-emerald-700">
              Kiểm tra ghim trên bản đồ trước khi tiếp tục tạo đơn.
            </Text>
          </View>
        </View>

        <GoongRouteMap
          route={mapRoute}
          height={300}
          showRouteDataNotice={false}
        />

        <MapShortcuts
          onOpenGoogleMaps={openGoogleMaps}
          onOpenAppleMaps={openAppleMaps}
          onOpenGoongMap={openGoongMap}
        />

        <View style={{ borderTopColor: colors.border.default }} className="flex-row items-start gap-2.5 border-t pt-3">
          <Ionicons name="location" size={18} color={colors.brand.primary} />
          <View className="flex-1">
            {location.name ? (
              <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
                {location.name}
              </Text>
            ) : null}
            <Text style={{ color: colors.text.secondary }} className="mt-0.5 text-xs leading-5">
              {location.address}
            </Text>
          </View>
        </View>
      </View>

      <Modal
        visible={isMapFullscreen}
        animationType="slide"
        onRequestClose={() => setIsMapFullscreen(false)}
      >
        <View style={{ backgroundColor: colors.surface.page }} className="flex-1">
          <View
            style={{
              backgroundColor: colors.surface.card,
              borderColor: colors.border.default,
              paddingTop: Math.max(insets.top + 6, 48),
            }}
            className="border-b px-4 pb-3 shadow-sm"
          >
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => setIsMapFullscreen(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng bản đồ toàn màn hình"
                style={{ backgroundColor: colors.brand.primarySoft }}
                className="rounded-full p-2.5"
              >
                <Ionicons name="close" size={20} color={colors.brand.primary} />
              </Pressable>

              <View className="flex-1 px-3">
                <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold uppercase tracking-wider">
                  Bản đồ giao hàng toàn màn hình
                </Text>
                <Text numberOfLines={1} style={{ color: colors.text.primary }} className="text-sm font-bold">
                  {location.name || location.address}
                </Text>
              </View>

              <Pressable
                onPress={() => setIsMapFullscreen(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                style={{ backgroundColor: colors.surface.muted }}
                className="rounded-xl px-3 py-1.5"
              >
                <Text style={{ color: colors.text.primary }} className="text-xs font-semibold">Đóng</Text>
              </Pressable>
            </View>

            <View className="mt-2.5">
              <MapShortcuts
                expanded
                onOpenGoogleMaps={openGoogleMaps}
                onOpenAppleMaps={openAppleMaps}
                onOpenGoongMap={openGoongMap}
              />
            </View>
          </View>

          <View className="flex-1 p-2">
            {isMapFullscreen ? (
              <GoongRouteMap
                route={mapRoute}
                isFullScreen
                showRouteDataNotice={false}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

type MapShortcutsProps = {
  expanded?: boolean;
  onOpenGoogleMaps: () => Promise<void>;
  onOpenAppleMaps: () => Promise<void>;
  onOpenGoongMap: () => Promise<void>;
};

function MapShortcuts({
  expanded = false,
  onOpenGoogleMaps,
  onOpenAppleMaps,
  onOpenGoongMap,
}: MapShortcutsProps) {
  return (
    <View className={`flex-row items-center gap-1.5 ${expanded ? 'justify-between' : 'justify-end flex-wrap'}`}>
      {!expanded ? <Text style={{ color: colors.text.muted }} className="text-[11px]">Mở ngoài:</Text> : null}
      <MapShortcut
        expanded={expanded}
        label="Google Map"
        icon="navigate-outline"
        backgroundColor="#EEF2FF"
        borderColor="#C7D2FE"
        textColor="#4338CA"
        onPress={onOpenGoogleMaps}
      />
      <MapShortcut
        expanded={expanded}
        label="Apple Map"
        icon="compass-outline"
        backgroundColor="#F1F5F9"
        borderColor="#CBD5E1"
        textColor="#334155"
        onPress={onOpenAppleMaps}
      />
      <MapShortcut
        expanded={expanded}
        label="Goong Map"
        icon="map-outline"
        backgroundColor="#FEF3C7"
        borderColor="#FDE68A"
        textColor="#B45309"
        onPress={onOpenGoongMap}
      />
    </View>
  );
}

type MapShortcutProps = {
  expanded: boolean;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  onPress: () => Promise<void>;
};

function MapShortcut({
  expanded,
  label,
  icon,
  backgroundColor,
  borderColor,
  textColor,
  onPress,
}: MapShortcutProps) {
  return (
    <Pressable
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityLabel={`Mở vị trí giao hàng bằng ${label}`}
      style={{ backgroundColor, borderColor }}
      className={`${expanded ? 'flex-1 justify-center py-2' : 'px-2 py-1'} flex-row items-center gap-1 rounded-lg border shadow-xs`}
    >
      <Ionicons name={icon} size={expanded ? 13 : 12} color={textColor} />
      <Text style={{ color: textColor }} className="text-[11px] font-bold">{label}</Text>
    </Pressable>
  );
}
