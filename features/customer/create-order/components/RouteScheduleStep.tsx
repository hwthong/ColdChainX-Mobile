import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { customerColors, customerRadius } from '../../../../constants/customerTheme';
import { CustomerCard, CustomerSectionHeader } from '../../../../components/customer/ui/CustomerUi';
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
  const [isChangingRoute, setIsChangingRoute] = useState(false);
  const selectedRoute = routes.find((route) => route.routeId === selectedRouteId) ?? null;
  const showRoutePicker = !selectedRoute || isChangingRoute;

  const handleSelectRoute = (routeId: string) => {
    setIsChangingRoute(false);
    onSelectRoute(routeId);
  };

  return (
    <View className="gap-4">
      <CustomerCard>
        <View className="gap-4">
          <CustomerSectionHeader
            title={selectedRoute && !showRoutePicker ? 'Tuyến đã chọn' : 'Tuyến vận chuyển'}
            icon="navigate-outline"
            actionLabel={selectedRoute && !showRoutePicker ? 'Thay đổi' : undefined}
            onAction={selectedRoute && !showRoutePicker ? () => setIsChangingRoute(true) : undefined}
          />

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
              <CustomerSectionHeader title="Lịch vận chuyển" icon="calendar-outline" />
              <ScheduleOptions
                bookingOptions={bookingOptions}
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
      </CustomerCard>

      <CustomerCard>
        <View className="gap-4">
          <CustomerSectionHeader title="Giao hàng" icon="location-outline" />

          <View ref={(node) => registerField('dropoffStopId', node)} className="gap-3">
            <CustomerSectionHeader title="Điểm giao hàng" />
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
              <AvailabilityNotice>Chọn tuyến vận chuyển để xem các điểm giao khả dụng.</AvailabilityNotice>
            )}
          </View>

          <View ref={(node) => registerField('destAddressText', node)}>
            <AddressAutocompleteField
              ref={(node) => registerInput('destAddressText', node)}
              value={address}
              error={errors.destAddressText}
              label="Địa chỉ giao hàng"
              onChangeText={onChangeAddress}
              onSelectAddress={onSelectAddress}
            />
          </View>
        </View>
      </CustomerCard>
    </View>
  );
}

function RouteSummary({ route }: { route: RouteOptionResponse }) {
  return (
    <View className="gap-1 p-4" style={{ backgroundColor: customerColors.primarySoft, borderRadius: customerRadius.control }}>
      <Text className="text-base font-bold text-[#3A1F04]">{getRouteLabel(route)}</Text>
      <Text className="text-xs leading-5 text-[#877369]">{getRouteMeta(route)}</Text>
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
      {isLoading ? <View className="items-center py-1"><ActivityIndicator size="small" color="#8B4513" /></View> : null}

      {error ? <LoadError message={error} actionLabel="Tải lại tuyến" onRetry={onRetry} /> : null}

      {!isLoading && !error && routes.length === 0 ? (
        <View
          className="p-4"
          style={{
            backgroundColor: customerColors.surfaceNeutral,
            borderColor: customerColors.border,
            borderRadius: 14,
            borderWidth: 1,
          }}
        >
          <Text className="text-sm leading-5 text-[#877369]">
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

type ScheduleOptionsProps = {
  bookingOptions: RouteBookingOptionsDto | null;
  isLoading: boolean;
  error: string | null;
  selectedScheduleId: string;
  scheduleError?: string;
  onRetry: () => void;
  onSelectSchedule: (scheduleId: string) => void;
};

function ScheduleOptions({
  bookingOptions,
  isLoading,
  error,
  selectedScheduleId,
  scheduleError,
  onRetry,
  onSelectSchedule,
}: ScheduleOptionsProps) {
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

  return bookingOptions.availableSchedules.length === 0 ? (
    <AvailabilityNotice>Tuyến này chưa có lịch khởi hành khả dụng. Vui lòng chọn tuyến khác.</AvailabilityNotice>
  ) : (
    <View className="gap-3">
      {bookingOptions.availableSchedules.map((schedule) => (
        <CreateOrderChoiceCard
          key={schedule.scheduleId}
          selected={selectedScheduleId === schedule.scheduleId}
          title={schedule.scheduleName}
          subtitle={`${formatDepartureDate(schedule.departureDate)} · Khởi hành ${schedule.departureTime.slice(0, 5)} · Đóng nhận ${schedule.cutOffTime.slice(0, 5)}`}
          accessibilityLabel={`Lịch ${schedule.scheduleName}, ${formatDepartureDate(schedule.departureDate)}`}
          onPress={() => onSelectSchedule(schedule.scheduleId)}
        />
      ))}
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
  if (isLoading) return <Text className="text-xs leading-5 text-[#877369]">Đang tải điểm giao hàng...</Text>;
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
        className="min-h-10 self-start justify-center rounded-lg bg-[#8B4513] px-3"
      >
        <Text className="text-xs font-bold text-white">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function AvailabilityNotice({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-2xl bg-[#F8F9FA] p-4">
      <Text className="text-sm leading-5 text-[#877369]">{children}</Text>
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
