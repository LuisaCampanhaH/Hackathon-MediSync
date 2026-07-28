import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { ScrollView, YStack, XStack, Text } from 'tamagui';
import { Feather } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeContext';
import { radii, shadow, space } from '../theme/tokens';
import { usePatientData, type Medication } from '../data/store';
import type { Navigate } from '../../App';

export default function ManageMedicationsScreen({ navigate }: { navigate: Navigate }) {
  const { colors } = useAppTheme();
  const { patient, deleteMedication } = usePatientData();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(med: Medication) {
    Alert.alert('Excluir medicamento', `Remover ${med.name} da lista de medicamentos?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(med.id);
          try {
            await deleteMedication(med.id);
          } catch (e) {
            Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível excluir.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  return (
    <YStack flex={1} backgroundColor={colors.bg}>
      <ScrollView contentContainerStyle={{ paddingTop: 52, paddingBottom: 40 }}>
        <XStack
          paddingHorizontal={space.lg}
          paddingBottom={space.section}
          alignItems="center"
          gap={14}
        >
          <Pressable
            onPress={() => navigate('dashboard')}
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.squircle,
              backgroundColor: colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          </Pressable>
          <YStack>
            <Text fontSize={19} fontWeight="800" color={colors.textPrimary}>
              Meus Medicamentos
            </Text>
            <Text fontSize={13} color={colors.textSecondary}>
              {patient.name}
            </Text>
          </YStack>
        </XStack>

        <YStack paddingHorizontal={space.lg} gap={space.md}>
          {patient.medications.length === 0 && (
            <Text fontSize={14.5} color={colors.textSecondary} textAlign="center" marginTop={40}>
              Nenhum medicamento cadastrado ainda.
            </Text>
          )}

          {patient.medications.map((med) => (
            <YStack
              key={med.id}
              backgroundColor={colors.surface}
              borderWidth={1}
              borderColor={colors.border}
              borderRadius={radii.lg}
              padding={space.cardPadSm}
              opacity={deletingId === med.id ? 0.5 : 1}
              {...shadow.card}
            >
              <XStack alignItems="flex-start" justifyContent="space-between">
                <YStack flex={1} gap={2}>
                  <Text fontSize={17} fontWeight="800" color={colors.textPrimary}>
                    {med.name}
                  </Text>
                  <Text fontSize={13.5} color={colors.textSecondary}>
                    {med.dosage} · {med.times.join(', ')}
                  </Text>
                  <Text fontSize={12.5} color={colors.textMuted} marginTop={2}>
                    Estoque: {med.stock} comprimidos
                  </Text>
                </YStack>
                <XStack gap={space.sm}>
                  <Pressable
                    onPress={() => navigate('add', undefined, med.id)}
                    disabled={deletingId === med.id}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 13,
                      backgroundColor: colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="edit-2" size={16} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(med)}
                    disabled={deletingId === med.id}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 13,
                      backgroundColor: colors.warnTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="trash-2" size={16} color={colors.warnText} />
                  </Pressable>
                </XStack>
              </XStack>
            </YStack>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
