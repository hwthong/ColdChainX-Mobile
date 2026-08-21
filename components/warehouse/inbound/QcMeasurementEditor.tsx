import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppInput } from '../../AppInput';
import { colors } from '../../../constants/colors';
import type {
  QcPackageLineErrors,
  QcPackageLineField,
  QcPackageLineFormValue,
  QcMeasurementSummaryValue,
} from '../../../features/warehouse/inbound/inboundQcMeasurements';
import { QcMeasurementSummary } from './QcMeasurementSummary';
import { QcPackageLineCard } from './QcPackageLineCard';

interface QcMeasurementEditorProps {
  heading: string;
  description?: string;
  lines: QcPackageLineFormValue[];
  errors: QcPackageLineErrors[];
  summary: QcMeasurementSummaryValue;
  temperature: string;
  temperatureError?: string;
  onChangeLine: (id: string, field: QcPackageLineField, value: string) => void;
  onAddLine: () => void;
  onRemoveLine: (id: string) => void;
  onChangeTemperature: (value: string) => void;
}

export function QcMeasurementEditor({
  heading,
  description,
  lines,
  errors,
  summary,
  temperature,
  temperatureError,
  onChangeLine,
  onAddLine,
  onRemoveLine,
  onChangeTemperature,
}: QcMeasurementEditorProps) {
  const temperatureKeyboardType = Platform.OS === 'ios'
    ? ('numbers-and-punctuation' as const)
    : ('numeric' as const);

  return (
    <View style={styles.container}>
      <View style={styles.headingGroup}>
        <Text style={styles.heading}>{heading}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      {lines.map((line, index) => (
        <QcPackageLineCard
          key={line.id}
          index={index}
          line={line}
          errors={errors[index]}
          canRemove={lines.length > 1}
          onChange={(field, value) => onChangeLine(line.id, field, value)}
          onRemove={() => onRemoveLine(line.id)}
        />
      ))}

      <Pressable accessibilityRole="button" onPress={onAddLine} style={styles.addButton}>
        <Ionicons name="add-circle-outline" size={19} color={colors.brand.primary} />
        <Text style={styles.addButtonText}>Thêm quy cách</Text>
      </Pressable>

      <QcMeasurementSummary summary={summary} />

      <AppInput
        label="Nhiệt độ thực đo (°C)"
        value={temperature}
        onChangeText={onChangeTemperature}
        placeholder="Không bắt buộc"
        keyboardType={temperatureKeyboardType}
        error={temperatureError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headingGroup: {
    gap: 3,
  },
  heading: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.secondary,
  },
  addButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand.primary,
    backgroundColor: colors.surface.card,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand.primary,
  },
});
