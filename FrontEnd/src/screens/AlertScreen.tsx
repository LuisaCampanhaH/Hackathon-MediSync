import { useState } from 'react';
import { Linking, Pressable } from 'react-native';
import { YStack, Text } from 'tamagui';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeContext';
import { radii, space } from '../theme/tokens';
import { getMedication, usePatientData } from '../data/store';
import { notifyError } from '../platformAlert';
import { formatLate, minutesLate } from '../utils/time';
import type { Navigate } from '../../App';

export default function AlertScreen({ navigate, doseId }: { navigate: Navigate; doseId?: string }) {
  const { colors } = useAppTheme();
  const { patient, markDoseTaken } = usePatientData();
  const [confirming, setConfirming] = useState(false);
  const dose = doseId
    ? patient.doseLog.find((d) => d.id === doseId)
    : patient.doseLog.find((d) => d.status === 'late');
  const med = dose ? getMedication(patient, dose.medicationId) : undefined;

  // ✨ CORRIGIDO: Adiciona delay após confirmação para garantir sync
  async function handleManualConfirm() {
    if (!dose) {
      navigate('dashboard');
      return;
    }
    setConfirming(true);
    try {
      await markDoseTaken(dose.id);
      
      // ✨ NOVO: Aguarda 1 segundo adicional para garantir que a UI
      // recebeu a atualização via WebSocket e refrescou o estado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      navigate('dashboard');
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Não foi possível confirmar a dose.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <YStack
      flex={1}
      backgroundColor={colors.alertBg}
      paddingHorizontal={28}
      paddingVertical={40}
      justifyContent="space-between"
    >
      <Pressable
        onPress={() => navigate('dashboard')}
        style={{
          position: 'absolute',
          top: 56,
          right: space.lg,
          width: 44,
          height: 44,
          borderRadius: radii.squircle,
          backgroundColor: colors.overlaySubtle,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <Feather name="x" size={18} color={colors.alertTitle} />
      </Pressable>

      <YStack alignItems="center" gap={space.md} flex={1} justifyContent="center">
        <YStack
          width={84}
          height={84}
          borderRadius={26}
          backgroundColor={colors.alertIconBg}
          alignItems="center"
          justifyContent="center"
          shadowColor="#000"
          shadowOffset={{ width: 0, height: 10 }}
          shadowOpacity={0.25}
          shadowRadius={20}
          elevation={8}
        >
          <Feather name="alert-triangle" size={42} color={colors.onWarn} />
        </YStack>

        <Text fontSize={25} fontWeight="800" color={colors.alertTitle}>
          Atenção
        </Text>

        {med && dose ? (
          <>
            <Text
              fontSize={18}
              lineHeight={27}
              color={colors.alertBody}
              textAlign="center"
              maxWidth={300}
            >
              O medicamento{' '}
              <Text fontWeight="800">
                {med.name} {med.dosage}
              </Text>{' '}
              está atrasado {formatLate(minutesLate(dose.scheduledTime))}.
            </Text>
            <Text fontSize={14} color={colors.alertBody} opacity={0.8} textAlign="center">
              {patient.name} · programado para {dose.scheduledTime} · caixinha do quarto
            </Text>
          </>
        ) : (
          <Text fontSize={18} color={colors.alertBody} textAlign="center">
            Nenhuma dose atrasada no momento.
          </Text>
        )}
      </YStack>

      <YStack gap={space.md} alignItems="center">
        {patient.phone && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${patient.phone}`)}
            style={{
              width: '100%',
              maxWidth: 320,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 18,
              elevation: 6,
            }}
          >
            <LinearGradient
              colors={colors.gradAlert}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.sm,
                minHeight: 60,
                borderRadius: 18,
              }}
            >
              <Feather name="phone-call" size={20} color={colors.onWarn} />
              <Text color={colors.onWarn} fontSize={17.5} fontWeight="700">
                Ligar para o Paciente
              </Text>
            </LinearGradient>
          </Pressable>
        )}

        <Pressable
          onPress={handleManualConfirm}
          disabled={confirming}
          style={{ width: '100%', maxWidth: 320, opacity: confirming ? 0.6 : 1 }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.sm,
              minHeight: 60,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: colors.alertSecondaryBorder,
            }}
          >
            <Feather name="check" size={18} color={colors.alertSecondaryFg} />
            <Text color={colors.alertSecondaryFg} fontSize={16} fontWeight="700">
              {confirming ? 'Confirmando...' : 'Marcar como tomado atrasado'}
            </Text>
          </LinearGradient>
        </Pressable>
      </YStack>
    </YStack>
  );
}
