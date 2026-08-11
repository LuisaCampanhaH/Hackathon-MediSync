import { useState } from 'react';
import { Linking, Pressable } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Feather } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeContext';
import { radii, space } from '../theme/tokens';
import { getMedication, usePatientData } from '../data/store';
import { notifyError } from '../platformAlert';
import type { Navigate } from '../../App';

function minutesLate(scheduledTime: string) {
  const [h, m] = scheduledTime.split(':').map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  return Math.max(1, Math.round((Date.now() - scheduled.getTime()) / 60000));
}

export default function AlertScreen({ navigate, doseId }: { navigate: Navigate; doseId?: string }) {
  const { colors } = useAppTheme();
  const { patient, markDoseTaken } = usePatientData();
  const [confirming, setConfirming] = useState(false);
  const dose = doseId
    ? patient.doseLog.find((d) => d.id === doseId)
    : patient.doseLog.find((d) => d.status === 'late');
  const med = dose ? getMedication(patient, dose.medicationId) : undefined;

  async function handleManualConfirm() {
    if (!dose) {
      navigate('dashboard');
      return;
    }
    setConfirming(true);
    try {
      await markDoseTaken(dose.id);
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
              está atrasado há {minutesLate(dose.scheduledTime)} minutos.
            </Text>
            <Text fontSize={14} color={colors.alertBody} opacity={0.8} textAlign="center">
              {patient.name} · caixinha no quarto
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
            style={{ width: '100%', maxWidth: 320 }}
          >
            <XStack
              alignItems="center"
              justifyContent="center"
              gap={space.sm}
              minHeight={60}
              borderRadius={18}
              backgroundColor={colors.alertPrimaryBg}
              shadowColor="#000"
              shadowOffset={{ width: 0, height: 8 }}
              shadowOpacity={0.2}
              shadowRadius={18}
              elevation={6}
            >
              <Feather name="phone-call" size={20} color={colors.onWarn} />
              <Text color={colors.onWarn} fontSize={17.5} fontWeight="700">
                Ligar para o Paciente
              </Text>
            </XStack>
          </Pressable>
        )}

        <Pressable onPress={handleManualConfirm} disabled={confirming} style={{ width: '100%', maxWidth: 320 }}>
          <XStack
            alignItems="center"
            justifyContent="center"
            gap={space.sm}
            minHeight={60}
            borderRadius={18}
            borderWidth={2}
            borderColor={colors.alertSecondaryBorder}
            opacity={confirming ? 0.6 : 1}
          >
            <Feather name="check" size={18} color={colors.alertSecondaryFg} />
            <Text color={colors.alertSecondaryFg} fontSize={16} fontWeight="700">
              {confirming ? 'Confirmando...' : 'Marcar como tomado atrasado'}
            </Text>
          </XStack>
        </Pressable>
      </YStack>
    </YStack>
  );
}
