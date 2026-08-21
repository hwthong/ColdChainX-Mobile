import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../../constants/colors';
import { customerRadius } from '../../../../constants/customerTheme';
import type { GoongPlaceDetail } from '../../../../services/goongPlacesApi';
import type {
  RouteBookingOptionsDto,
  RouteOptionResponse,
  ScheduleOptionDto,
} from '../../../../services/routeApi';
import type { CreateOrderValidationErrors } from '../createOrderValidation';
import { AddressAutocompleteField } from './AddressAutocompleteField';
import {
  CreateOrderChoiceCard,
  type RegisterCreateOrderField,
  type RegisterCreateOrderInput,
} from './CreateOrderUi';

type RouteScheduleStepProps = {
  routes: RouteOptionResponse[];
  selectedRouteId: string;
  bookingOptions: RouteBookingOptionsDto | null;
  selectedScheduleId: string;
  selectedStopId: string;
  address: string;
  destinationLocation: GoongPlaceDetail | null;
  receiverName: string;
  receiverPhone: string;
  errors: CreateOrderValidationErrors;
  isLoadingRoutes: boolean;
  isLoadingBooking: boolean;
  routeError: string | null;
  bookingError: string | null;
  registerField: RegisterCreateOrderField;
  registerInput: RegisterCreateOrderInput;
  onRetryRoutes: () => void;
  onRetryBooking: () => void;
  onSelectRoute: (routeId: string) => void;
  onSelectSchedule: (scheduleId: string) => void;
  onSelectStop: (stopId: string) => void;
  onConfirmDeliveryContact: (payload: {
    location: GoongPlaceDetail;
    receiverName: string;
    receiverPhone: string;
  }) => void;
  onChangeReceiverName?: (name: string) => void;
  onChangeReceiverPhone?: (phone: string) => void;
  onFocusField?: (field: 'receiverName' | 'receiverPhone') => void;
  onBlurField?: (field: 'receiverName' | 'receiverPhone') => void;
  onSubmitField?: (field: 'receiverName' | 'receiverPhone') => void;
};

export function RouteScheduleStep({
  routes,
  selectedRouteId,
  bookingOptions,
  selectedScheduleId,
  selectedStopId,
  address,
  destinationLocation,
  receiverName,
  receiverPhone,
  errors,
  isLoadingRoutes,
  isLoadingBooking,
  routeError,
  bookingError,
  registerField,
  registerInput,
  onRetryRoutes,
  onRetryBooking,
  onSelectRoute,
  onSelectSchedule,
  onSelectStop,
  onConfirmDeliveryContact,
  onChangeReceiverName,
  onChangeReceiverPhone,
  onFocusField,
  onBlurField,
  onSubmitField,
}: RouteScheduleStepProps) {
  const [isChangingRoute, setIsChangingRoute] = useState(false);
  const selectedRoute = routes.find((route) => route.routeId === selectedRouteId) ?? null;
  const showRoutePicker = !selectedRoute || isChangingRoute;

  const handleSelectRoute = (routeId: string) => {
    setIsChangingRoute(false);
    onSelectRoute(routeId);
  };

  const deliveryError = errors.destAddressText || errors.receiverName || errors.receiverPhone;

  return (
    <View className="gap-5">
      <View style={styles.sectionSurface}>
        <SectionHeading icon="calendar-outline" title="Lịch vận chuyển" />
        <View style={styles.sectionDivider} />

        <View style={styles.subsectionHeader}>
          <Text style={styles.fieldLabel}>
            {selectedRoute && !showRoutePicker ? 'Tuyến đã chọn' : 'Tuyến vận chuyển'}
          </Text>
          {selectedRoute && !showRoutePicker ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thay đổi tuyến vận chuyển"
              hitSlop={8}
              onPress={() => setIsChangingRoute(true)}
            >
              <Text style={styles.actionText}>Thay đổi</Text>
            </Pressable>
          ) : null}
        </View>

        <View ref={(node) => registerField('routeId', node)}>
          {showRoutePicker ? (
            <RouteOptionPicker
              routes={routes}
              selectedRouteId={selectedRouteId}
              isLoading={isLoadingRoutes}
              error={routeError}
              onRetry={onRetryRoutes}
              onSelect={handleSelectRoute}
            />
          ) : (
            <RouteSummary route={selectedRoute} />
          )}
          {errors.routeId ? <FieldError message={errors.routeId} /> : null}
        </View>

        {selectedRoute && !showRoutePicker ? (
          <View ref={(node) => registerField('scheduleId', node)} className="gap-3">
            <Text style={styles.fieldLabel}>Ngày và giờ khởi hành <Text style={styles.required}>*</Text></Text>
            <ScheduleOptions
              bookingOptions={bookingOptions}
              selectedRoute={selectedRoute}
              isLoading={isLoadingBooking}
              error={bookingError}
              selectedScheduleId={selectedScheduleId}
              scheduleError={errors.scheduleId}
              onRetry={onRetryBooking}
              onSelectSchedule={onSelectSchedule}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.sectionSurface}>
        <SectionHeading icon="location-outline" title="Điểm giao hàng" />
        <View style={styles.sectionDivider} />

        <View ref={(node) => registerField('dropoffStopId', node)} className="gap-3">
          <Text style={styles.fieldLabel}>Điểm dừng trên tuyến <Text style={styles.required}>*</Text></Text>
          {selectedRouteId ? (
            <DropoffOptions
              bookingOptions={bookingOptions}
              isLoading={isLoadingBooking}
              error={bookingError}
              selectedStopId={selectedStopId}
              stopError={errors.dropoffStopId}
              onSelectStop={onSelectStop}
            />
          ) : (
            <AvailabilityNotice>Chọn tuyến vận chuyển để xem các điểm dừng khả dụng.</AvailabilityNotice>
          )}
        </View>

        <View ref={(node) => registerField('destAddressText', node)}>
          <AddressAutocompleteField
            value={address}
            selectedLocation={destinationLocation}
            receiverName={receiverName}
            receiverPhone={receiverPhone}
            destinationCity={selectedRoute ? formatCityName(selectedRoute.destCity) : undefined}
            error={deliveryError}
            disabled={!selectedRouteId || !selectedScheduleId || !selectedStopId}
            onConfirmDeliveryContact={onConfirmDeliveryContact}
          />
        </View>
      </View>
    </View>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Ionicons name={icon} size={19} color={colors.brand.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function RouteSummary({ route }: { route: RouteOptionResponse }) {
  return (
    <View className="gap-1 p-4" style={{ backgroundColor: colors.surface.selected, borderRadius: customerRadius.control }}>
      <Text style={{ color: colors.text.primary }} className="text-base font-bold">{getRouteLabel(route)}</Text>
      <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">{getRouteMeta(route)}</Text>
    </View>
  );
}

type RouteOptionPickerProps = {
  routes: RouteOptionResponse[];
  selectedRouteId: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (routeId: string) => void;
};

function RouteOptionPicker({
  routes,
  selectedRouteId,
  isLoading,
  error,
  onRetry,
  onSelect,
}: RouteOptionPickerProps) {
  return (
    <View className="gap-2">
      {isLoading ? <View className="items-center py-1"><ActivityIndicator size="small" color={colors.brand.primary} /></View> : null}

      {error ? <LoadError message={error} actionLabel="Tải lại tuyến" onRetry={onRetry} /> : null}

      {!isLoading && !error && routes.length === 0 ? (
        <View
          className="p-4"
          style={{
            backgroundColor: colors.surface.page,
            borderColor: colors.border.default,
            borderRadius: 14,
            borderWidth: 1,
          }}
        >
          <Text style={{ color: colors.text.secondary }} className="text-sm leading-5">
            Chưa có tuyến vận chuyển khả dụng. Vui lòng thử lại sau.
          </Text>
        </View>
      ) : null}

      <View className="gap-2">
        {routes.map((route) => (
          <CreateOrderChoiceCard
            key={route.routeId}
            selected={selectedRouteId === route.routeId}
            title={getRouteLabel(route)}
            subtitle={getRouteMeta(route)}
            accessibilityHint={getRouteMeta(route)}
            onPress={() => onSelect(route.routeId)}
          />
        ))}
      </View>
    </View>
  );
}

export type ScheduleDateGroup = {
  dateKey: string;
  dateLabel: string;
  dayOfWeekLabel: string;
  schedules: ScheduleOptionDto[];
};

type ScheduleOptionsProps = {
  bookingOptions: RouteBookingOptionsDto | null;
  selectedRoute: RouteOptionResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedScheduleId: string;
  scheduleError?: string;
  onRetry: () => void;
  onSelectSchedule: (scheduleId: string) => void;
};

function ScheduleOptions({
  bookingOptions,
  selectedRoute,
  isLoading,
  error,
  selectedScheduleId,
  scheduleError,
  onRetry,
  onSelectSchedule,
}: ScheduleOptionsProps) {
  // 1. Derive arrays safely (unconditional)
  const schedules = bookingOptions?.availableSchedules ?? [];
  const routeId = bookingOptions?.routeId ?? '';

  const sortedSchedules = React.useMemo(() => {
    return [...schedules].sort((a, b) => {
      const dCmp = a.departureDate.localeCompare(b.departureDate);
      if (dCmp !== 0) return dCmp;
      return a.departureTime.localeCompare(b.departureTime);
    });
  }, [schedules]);

  const dateGroups = React.useMemo(() => {
    const dateGroupsMap = new Map<string, ScheduleOptionDto[]>();
    for (const s of sortedSchedules) {
      const key = s.departureDate.trim();
      if (!dateGroupsMap.has(key)) {
        dateGroupsMap.set(key, []);
      }
      dateGroupsMap.get(key)!.push(s);
    }
    return Array.from(dateGroupsMap.entries()).map(([key, list]) => ({
      dateKey: key,
      dateLabel: getShortDateLabel(key),
      dayOfWeekLabel: getDayOfWeekLabel(key),
      schedules: list,
    }));
  }, [sortedSchedules]);

  const currentSchedule = React.useMemo(() => {
    return sortedSchedules.find((s) => s.scheduleId === selectedScheduleId) ?? null;
  }, [sortedSchedules, selectedScheduleId]);

  // 2. Unconditional Hooks (Top level before any early return)
  const [activeDateKey, setActiveDateKey] = useState<string>('');

  React.useEffect(() => {
    if (currentSchedule) {
      setActiveDateKey(currentSchedule.departureDate);
    } else if (dateGroups.length > 0 && (!activeDateKey || !dateGroups.some((g) => g.dateKey === activeDateKey))) {
      setActiveDateKey(dateGroups[0].dateKey);
    }
  }, [selectedScheduleId, currentSchedule, routeId, dateGroups]);

  // 3. Early Returns (Safe after all hooks)
  if (isLoading) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color={colors.brand.primary} />
        <Text style={{ color: colors.text.secondary }} className="mt-2 text-xs">Đang tải lịch khởi hành...</Text>
      </View>
    );
  }

  if (error) return <LoadError message={error} actionLabel="Thử lại" onRetry={onRetry} />;
  if (!bookingOptions) return null;

  if (schedules.length === 0) {
    return <AvailabilityNotice>Hiện chưa có lịch khởi hành phù hợp. Vui lòng chọn tuyến khác.</AvailabilityNotice>;
  }

  const activeGroup = dateGroups.find((g) => g.dateKey === activeDateKey) ?? dateGroups[0];

  const handleSelectDate = (dateKey: string) => {
    setActiveDateKey(dateKey);
    if (currentSchedule && currentSchedule.departureDate !== dateKey) {
      onSelectSchedule('');
    }
  };

  return (
    <View className="gap-4">
      {/* 1. DATE SELECTOR */}
      <View className="gap-1.5">
        <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold uppercase tracking-wider">Ngày khởi hành</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 py-1">
          {dateGroups.map((group) => {
            const isSelected = group.dateKey === activeDateKey;
            return (
              <Pressable
                key={group.dateKey}
                onPress={() => handleSelectDate(group.dateKey)}
                accessibilityRole="button"
                accessibilityLabel={`Ngày ${group.dayOfWeekLabel} ${group.dateLabel}`}
                style={{
                  backgroundColor: isSelected ? colors.brand.primarySoft : '#FFFFFF',
                  borderColor: isSelected ? colors.brand.primary : 'rgba(189, 214, 231, 0.5)',
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingVertical: 9,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  minWidth: 64,
                  shadowColor: isSelected ? colors.brand.primary : '#173b59',
                  shadowOffset: { width: 0, height: isSelected ? 2 : 1 },
                  shadowOpacity: isSelected ? 0.1 : 0.03,
                  shadowRadius: isSelected ? 4 : 2,
                  elevation: isSelected ? 2 : 1,
                }}
              >
                <Text style={{ color: isSelected ? colors.brand.primary : colors.text.primary }} className="text-xs font-bold">
                  {group.dayOfWeekLabel}
                </Text>
                <Text style={{ color: isSelected ? colors.brand.primary : colors.text.secondary }} className="mt-0.5 text-xs font-medium">
                  {group.dateLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. TIME SELECTOR */}
      {activeGroup ? (
        <View className="gap-1.5">
          <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold uppercase tracking-wider">Giờ khởi hành</Text>
          <View className="flex-row flex-wrap gap-2 py-1">
            {activeGroup.schedules.map((schedule) => {
              const isSelected = schedule.scheduleId === selectedScheduleId;
              const timeDisplay = schedule.departureTime.slice(0, 5);
              return (
                <Pressable
                  key={schedule.scheduleId}
                  onPress={() => onSelectSchedule(schedule.scheduleId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Khởi hành lúc ${timeDisplay}`}
                  style={{
                    backgroundColor: isSelected ? colors.brand.primarySoft : '#FFFFFF',
                    borderColor: isSelected ? colors.brand.primary : 'rgba(189, 214, 231, 0.5)',
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    alignItems: 'center',
                    shadowColor: isSelected ? colors.brand.primary : '#173b59',
                    shadowOffset: { width: 0, height: isSelected ? 2 : 1 },
                    shadowOpacity: isSelected ? 0.1 : 0.03,
                    shadowRadius: isSelected ? 4 : 2,
                    elevation: isSelected ? 2 : 1,
                  }}
                >
                  <Text style={{ color: isSelected ? colors.brand.primary : colors.text.primary }} className="text-sm font-bold">
                    {timeDisplay}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* 3. CUTOFF & ETA SUMMARY CARD */}
      {currentSchedule ? (
        <View
          style={{
            backgroundColor: 'rgba(226, 239, 248, 0.65)',
            borderColor: 'rgba(114, 169, 210, 0.4)',
            borderWidth: 1,
            borderRadius: 16,
            padding: 14,
            gap: 6,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text style={{ color: colors.brand.primary }} className="text-xs font-bold">
              Nhận hàng trước {currentSchedule.cutOffTime.slice(0, 5)}
            </Text>
            <Text style={{ color: colors.text.primary }} className="text-xs font-bold">
              {calculateEtaText(currentSchedule.departureDate, currentSchedule.departureTime, selectedRoute?.transitTime)}
            </Text>
          </View>
          <Text style={{ color: colors.text.secondary }} className="text-[11px] leading-4">
            * Lịch dự kiến, sẽ được xác nhận khi đơn hàng được xử lý.
          </Text>
        </View>
      ) : null}

      {scheduleError ? <FieldError message={scheduleError} /> : null}
    </View>
  );
}

type DropoffOptionsProps = {
  bookingOptions: RouteBookingOptionsDto | null;
  isLoading: boolean;
  error: string | null;
  selectedStopId: string;
  stopError?: string;
  onSelectStop: (stopId: string) => void;
};

function DropoffOptions({ bookingOptions, isLoading, error, selectedStopId, stopError, onSelectStop }: DropoffOptionsProps) {
  if (isLoading) return <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">Đang tải điểm giao hàng...</Text>;
  if (error || !bookingOptions) return null;
  if (bookingOptions.availableStops.length === 0) return <AvailabilityNotice>Tuyến này chưa có điểm giao. Vui lòng chọn tuyến khác.</AvailabilityNotice>;

  return (
    <View className="gap-3">
      {bookingOptions.availableStops.map((stop) => (
        <CreateOrderChoiceCard
          key={stop.stopId}
          selected={selectedStopId === stop.stopId}
          title={stop.stopName}
          accessibilityLabel={`Điểm giao ${stop.stopName}`}
          onPress={() => onSelectStop(stop.stopId)}
        />
      ))}
      {stopError ? <FieldError message={stopError} /> : null}
    </View>
  );
}

function LoadError({
  message,
  actionLabel,
  onRetry,
}: {
  message: string;
  actionLabel: string;
  onRetry: () => void;
}) {
  return (
    <View className="gap-3 rounded-[14px] border border-red-200 bg-red-50 p-4">
      <Text accessibilityLiveRegion="polite" className="text-sm font-semibold leading-5 text-red-700">
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={{ backgroundColor: colors.brand.primary }}
        className="min-h-10 self-start justify-center rounded-lg px-3"
      >
        <Text style={{ color: colors.text.onPrimary }} className="text-xs font-bold">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function AvailabilityNotice({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface.page }} className="rounded-2xl p-4">
      <Text style={{ color: colors.text.secondary }} className="text-sm leading-5">{children}</Text>
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <Text accessibilityLiveRegion="polite" className="mt-1 text-xs font-medium text-red-600">
      {message}
    </Text>
  );
}

function parseTransitHours(transitTime: string | null | undefined): number {
  if (!transitTime || typeof transitTime !== 'string') return 8;
  const match = transitTime.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 8;
}

function getDayOfWeekLabel(dateStr: string): string {
  const parts = dateStr.trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return '—';
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return days[date.getDay()] ?? '—';
}

function getShortDateLabel(dateStr: string): string {
  const parts = dateStr.trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [, month, day] = parts;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function calculateEtaText(departureDateStr: string, departureTimeStr: string, transitTimeStr: string | null | undefined): string {
  const dateParts = departureDateStr.trim().split('-').map(Number);
  const timeParts = departureTimeStr.trim().split(':').map(Number);
  if (dateParts.length !== 3 || dateParts.some(Number.isNaN)) return '—';

  const [year, month, day] = dateParts;
  const hours = timeParts[0] ?? 0;
  const mins = timeParts[1] ?? 0;

  const depDate = new Date(year, month - 1, day, hours, mins);
  const transitHours = parseTransitHours(transitTimeStr);

  const etaDate = new Date(depDate.getTime() + transitHours * 60 * 60 * 1000);
  const etaHoursStr = `${String(etaDate.getHours()).padStart(2, '0')}:${String(etaDate.getMinutes()).padStart(2, '0')}`;

  const isSameDay = etaDate.getFullYear() === depDate.getFullYear() &&
                    etaDate.getMonth() === depDate.getMonth() &&
                    etaDate.getDate() === depDate.getDate();

  if (isSameDay) {
    return `Dự kiến đến ${etaHoursStr}`;
  }

  const dayName = getDayOfWeekLabel(`${etaDate.getFullYear()}-${String(etaDate.getMonth() + 1).padStart(2, '0')}-${String(etaDate.getDate()).padStart(2, '0')}`);
  const etaDateLabel = `${String(etaDate.getDate()).padStart(2, '0')}/${String(etaDate.getMonth() + 1).padStart(2, '0')}`;
  return `Dự kiến đến ${etaHoursStr}, ${dayName} ${etaDateLabel}`;
}

function formatCityName(city: string) {
  switch (city.trim().toUpperCase()) {
    case 'HCM':
      return 'TP.HCM';
    case 'CAN THO':
      return 'Cần Thơ';
    case 'DA NANG':
      return 'Đà Nẵng';
    case 'HA NOI':
      return 'Hà Nội';
    case 'DAK LAK':
      return 'Đắk Lắk';
    default:
      return city;
  }
}

export function getRouteLabel(route: RouteOptionResponse) {
  return `${formatCityName(route.originCity)} → ${formatCityName(route.destCity)}`;
}

export function formatTransitDuration(transitTime: string | null | undefined): string {
  if (!transitTime || typeof transitTime !== 'string') {
    return 'Dự kiến 8 giờ';
  }
  const trimmed = transitTime.trim();
  if (!trimmed) return 'Dự kiến 8 giờ';

  const formatted = trimmed
    .replace(/hours?/gi, 'giờ')
    .replace(/mins?|minutes?/gi, 'phút');

  return `Dự kiến ${formatted}`;
}

function getRouteMeta(route: RouteOptionResponse) {
  return formatTransitDuration(route.transitTime);
}

function formatDepartureDate(value: string): string {
  if (!value || typeof value !== 'string') return '—';
  const parts = value.trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return value;
  const [year, month, day] = parts;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return value;
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return value;
  }
  const days = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = days[date.getDay()] ?? '—';
  return `${dayName}, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function formatScheduleLabel(schedule: ScheduleOptionDto) {
  return `${formatDepartureDate(schedule.departureDate)} · Khởi hành ${schedule.departureTime.slice(0, 5)}`;
}

const styles = StyleSheet.create({
  sectionSurface: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: 17,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionDivider: {
    backgroundColor: colors.border.default,
    height: StyleSheet.hairlineWidth,
    marginTop: -6,
  },
  subsectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  required: {
    color: '#DC2626',
  },
  actionText: {
    color: colors.brand.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
