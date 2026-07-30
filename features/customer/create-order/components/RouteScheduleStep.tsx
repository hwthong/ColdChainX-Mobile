import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type {
  RouteBookingOptionsDto,
  RouteOptionResponse,
  ScheduleOptionDto,
} from '../../../../services/routeApi';
import type { CreateOrderValidationErrors } from '../createOrderValidation';
import { AddressAutocompleteField } from './AddressAutocompleteField';
import {
  CreateOrderFormSection,
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
  onChangeAddress: (address: string) => void;
  onSelectAddress: (address: string) => void;
};

export function RouteScheduleStep({
  routes,
  selectedRouteId,
  bookingOptions,
  selectedScheduleId,
  selectedStopId,
  address,
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
  onChangeAddress,
  onSelectAddress,
}: RouteScheduleStepProps) {
  return (
    <CreateOrderFormSection
      title="Tuyến và lịch"
      icon="navigate-outline"
      description="Chọn tuyến đang hoạt động, lịch khởi hành và điểm giao phù hợp."
    >
      <View className="rounded-xl bg-[#F8F3EF] p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="business-outline" size={17} color="#8B4513" />
          <Text className="text-sm font-bold text-[#3A1F04]">Điểm lấy hàng</Text>
        </View>
        <Text className="mt-1.5 text-sm leading-5 text-[#877369]">
          Hub ColdChainX sẽ được xác nhận sau khi yêu cầu được duyệt.
        </Text>
      </View>

      <View ref={(node) => registerField('routeId', node)}>
        <RouteOptionPicker
          routes={routes}
          selectedRouteId={selectedRouteId}
          isLoading={isLoadingRoutes}
          error={routeError}
          onRetry={onRetryRoutes}
          onSelect={onSelectRoute}
        />
        {errors.routeId ? <FieldError message={errors.routeId} /> : null}
      </View>

      {selectedRouteId ? (
        <View
          ref={(node) => {
            registerField('scheduleId', node);
            registerField('dropoffStopId', node);
          }}
        >
          <BookingOptionsPicker
            bookingOptions={bookingOptions}
            isLoading={isLoadingBooking}
            error={bookingError}
            selectedScheduleId={selectedScheduleId}
            selectedStopId={selectedStopId}
            scheduleError={errors.scheduleId}
            stopError={errors.dropoffStopId}
            onRetry={onRetryBooking}
            onSelectSchedule={onSelectSchedule}
            onSelectStop={onSelectStop}
          />
        </View>
      ) : (
        <View className="rounded-xl border border-dashed border-[#DAC2B6] bg-[#F8F9FA] p-4">
          <Text className="text-sm leading-5 text-[#877369]">
            Chọn tuyến vận chuyển để xem lịch và điểm giao.
          </Text>
        </View>
      )}

      <View ref={(node) => registerField('destAddressText', node)}>
        <AddressAutocompleteField
          ref={(node) => registerInput('destAddressText', node)}
          value={address}
          error={errors.destAddressText}
          onChangeText={onChangeAddress}
          onSelectAddress={onSelectAddress}
        />
      </View>
    </CreateOrderFormSection>
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
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] font-bold text-[#3A1F04]">Tuyến vận chuyển</Text>
        {isLoading ? <ActivityIndicator size="small" color="#8B4513" /> : null}
      </View>

      {error ? <LoadError message={error} actionLabel="Tải lại tuyến" onRetry={onRetry} /> : null}

      {!isLoading && !error && routes.length === 0 ? (
        <View className="rounded-[14px] border border-[#DAC2B6]/60 bg-[#F8F9FA] p-4">
          <Text className="text-sm leading-5 text-[#877369]">
            Chưa có tuyến vận chuyển khả dụng. Vui lòng thử lại sau.
          </Text>
        </View>
      ) : null}

      <View className="gap-2">
        {routes.map((route) => (
          <SelectableCard
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

type BookingOptionsPickerProps = {
  bookingOptions: RouteBookingOptionsDto | null;
  isLoading: boolean;
  error: string | null;
  selectedScheduleId: string;
  selectedStopId: string;
  scheduleError?: string;
  stopError?: string;
  onRetry: () => void;
  onSelectSchedule: (scheduleId: string) => void;
  onSelectStop: (stopId: string) => void;
};

function BookingOptionsPicker({
  bookingOptions,
  isLoading,
  error,
  selectedScheduleId,
  selectedStopId,
  scheduleError,
  stopError,
  onRetry,
  onSelectSchedule,
  onSelectStop,
}: BookingOptionsPickerProps) {
  if (isLoading) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color="#8B4513" />
        <Text className="mt-2 text-xs text-[#877369]">Đang tải lịch khởi hành...</Text>
      </View>
    );
  }

  if (error) return <LoadError message={error} actionLabel="Thử lại" onRetry={onRetry} />;
  if (!bookingOptions) return null;

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-[13px] font-bold text-[#3A1F04]">Lịch vận chuyển</Text>
        {bookingOptions.availableSchedules.length === 0 ? (
          <AvailabilityNotice>
            Tuyến này chưa có lịch khởi hành khả dụng. Vui lòng chọn tuyến khác.
          </AvailabilityNotice>
        ) : (
          <View className="gap-2">
            {bookingOptions.availableSchedules.map((schedule) => (
              <SelectableCard
                key={schedule.scheduleId}
                selected={selectedScheduleId === schedule.scheduleId}
                title={schedule.scheduleName}
                subtitle={`${formatDepartureDate(schedule.departureDate)} · Khởi hành ${schedule.departureTime.slice(0, 5)} · Đóng nhận ${schedule.cutOffTime.slice(0, 5)}`}
                accessibilityLabel={`Lịch ${schedule.scheduleName}, ${formatDepartureDate(schedule.departureDate)}`}
                onPress={() => onSelectSchedule(schedule.scheduleId)}
              />
            ))}
          </View>
        )}
        {scheduleError ? <FieldError message={scheduleError} /> : null}
      </View>

      <View className="gap-2">
        <Text className="text-[13px] font-bold text-[#3A1F04]">Điểm giao hàng</Text>
        {bookingOptions.availableStops.length === 0 ? (
          <AvailabilityNotice>
            Tuyến này chưa có điểm giao. Vui lòng chọn tuyến khác.
          </AvailabilityNotice>
        ) : (
          <View className="gap-2">
            {bookingOptions.availableStops.map((stop) => (
              <SelectableCard
                key={stop.stopId}
                selected={selectedStopId === stop.stopId}
                title={stop.stopName}
                accessibilityLabel={`Điểm giao ${stop.stopName}`}
                onPress={() => onSelectStop(stop.stopId)}
              />
            ))}
          </View>
        )}
        {stopError ? <FieldError message={stopError} /> : null}
      </View>
    </View>
  );
}

type SelectableCardProps = {
  selected: boolean;
  title: string;
  subtitle?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
};

function SelectableCard({
  selected,
  title,
  subtitle,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: SelectableCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      className={[
        'min-h-[60px] justify-center rounded-[14px] border px-4 py-3',
        selected ? 'border-[#8B4513] bg-[#8B4513]' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]',
      ].join(' ')}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={['text-sm font-bold', selected ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
            {title}
          </Text>
          {subtitle ? (
            <Text className={['mt-1 text-xs leading-5', selected ? 'text-white/75' : 'text-[#877369]'].join(' ')}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={20} color="#FFC29F" /> : null}
      </View>
    </Pressable>
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
        className="min-h-10 self-start justify-center rounded-lg bg-[#8B4513] px-3"
      >
        <Text className="text-xs font-bold text-white">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function AvailabilityNotice({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-[14px] border border-amber-200 bg-amber-50 p-4">
      <Text className="text-sm leading-5 text-amber-800">{children}</Text>
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

function getRouteMeta(route: RouteOptionResponse) {
  return `${route.routeCode} · Dự kiến ${route.transitTime}`;
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
  return `${schedule.scheduleName} · ${formatDepartureDate(schedule.departureDate)} · Khởi hành ${schedule.departureTime.slice(0, 5)}`;
}
