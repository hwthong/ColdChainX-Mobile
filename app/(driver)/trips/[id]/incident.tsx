import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WH_COLORS } from '../../../../constants/warehouseTheme';
import { AppToast } from '../../../../components/AppToast';

export default function DriverTripIncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mô tả sự cố.');
      return;
    }

    Alert.alert('Thông báo', 'Tính năng đang được hoàn thiện.');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: WH_COLORS.background }} contentContainerStyle={{ padding: 20 }}>

      <Text style={{ fontSize: 24, fontWeight: 'bold', color: WH_COLORS.textPrimary, marginBottom: 8 }}>
        Báo cáo Sự cố
      </Text>
      <Text style={{ fontSize: 14, color: WH_COLORS.textSecondary, marginBottom: 24 }}>
        Chuyến: {id?.substring(0, 8).toUpperCase()}
      </Text>

      <View style={{ backgroundColor: WH_COLORS.cardBg, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: WH_COLORS.cardBorder, marginBottom: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: WH_COLORS.textPrimary, marginBottom: 8 }}>
          Mô tả chi tiết sự cố *
        </Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: WH_COLORS.inputBorder,
            borderRadius: 8,
            padding: 12,
            height: 120,
            textAlignVertical: 'top',
            color: WH_COLORS.textPrimary,
          }}
          placeholder="Ví dụ: Xe hỏng lốp, tắc đường nghiêm trọng, hư hỏng hàng hoá..."
          placeholderTextColor={WH_COLORS.placeholder}
          multiline
          value={description}
          onChangeText={setDescription}
          editable={!submitting}
        />
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: '#991B1B',
          padding: 16,
          borderRadius: 12,
          alignItems: 'center',
          opacity: pressed || submitting ? 0.7 : 1,
          marginBottom: 16,
        })}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Gửi Báo Cáo</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        disabled={submitting}
        style={{ padding: 16, backgroundColor: WH_COLORS.primaryLight, borderRadius: 12, alignItems: 'center' }}
      >
        <Text style={{ color: WH_COLORS.primary, fontWeight: 'bold' }}>Quay lại</Text>
      </Pressable>

    </ScrollView>
  );
}
