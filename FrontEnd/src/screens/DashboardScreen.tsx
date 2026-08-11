import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { ScrollView, YStack, XStack, Text } from 'tamagui';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeContext';
import { radii, shadow, space } from '../theme/tokens';
import { getMedication, usePatientData, type DoseLogEntry } from '../data/store';
import type { Navigate } from '../../App';

function minutesLate(scheduledTime: string) {
  const [h, m] = scheduledTime.split(':').map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  return Math.max(1, Math.round((Date.now() - scheduled.getTime()) / 60000));
}

// null quando é hoje (não precisa rótulo extra), "Amanhã" ou "Seg 28/07" caso contrário
function dayLabelFor(scheduledAt: string) {
  const target = new Date(scheduledAt);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return null;
  if (diffDays === 1) return 'Amanhã';
  const date = new Date(scheduledAt);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${DAY_LABELS[date.getDay()]} ${dd}/${mm}`;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function DashboardScreen({ navigate }: { navigate: Navigate }) {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const { patient } = usePatientData();

  const pendingDoses = patient.doseLog
    .filter((d) => d.status === 'pending')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const nextDose = pendingDoses[0];
  const nextMed = nextDose ? getMedication(patient, nextDose.medicationId) : undefined;
  const nextDoseDayLabel = nextDose ? dayLabelFor(nextDose.scheduledAt) : null;

  const [remaining, setRemaining] = useState(() =>
    nextDose ? new Date(nextDose.scheduledAt).getTime() - Date.now() : 0
  );
  useEffect(() => {
    if (!nextDose) return;
    const target = new Date(nextDose.scheduledAt).getTime();
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
    // re-run only when the next dose actually changes, not on every object identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextDose?.id]);

  const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const countdownLabel = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  function iconFor(dose: DoseLogEntry, isNext: boolean) {
    if (dose.status === 'taken') {
      return (
        <YStack
          width={32}
          height={32}
          borderRadius={16}
          backgroundColor={colors.success}
          alignItems="center"
          justifyContent="center"
        >
          <Feather name="check" size={18} color={colors.onPrimary} />
        </YStack>
      );
    }
    if (dose.status === 'late') {
      return (
        <Pressable onPress={() => navigate('alert', dose.id)}>
          <YStack
            width={32}
            height={32}
            borderRadius={16}
            backgroundColor={colors.warn}
            alignItems="center"
            justifyContent="center"
          >
            <Feather name="clock" size={18} color={colors.onWarn} />
          </YStack>
        </Pressable>
      );
    }
    if (isNext) {
      return (
        <YStack
          width={32}
          height={32}
          borderRadius={16}
          borderWidth={3}
          borderColor={colors.primary}
          alignItems="center"
          justifyContent="center"
        >
          <YStack width={8} height={8} borderRadius={4} backgroundColor={colors.primary} />
        </YStack>
      );
    }
    return (
      <YStack
        width={32}
        height={32}
        borderRadius={16}
        backgroundColor={colors.surface}
        borderWidth={2.5}
        borderColor={colors.border}
      />
    );
  }

  return (
    <YStack flex={1} position="relative">
      <ScrollView
        backgroundColor={colors.bg}
        contentContainerStyle={{ paddingTop: 52, paddingBottom: 12 }}
      >
        <XStack
          paddingHorizontal={space.lg}
          paddingBottom={space.section}
          alignItems="center"
          justifyContent="space-between"
        >
          <XStack alignItems="center" gap={10}>
            <YStack
              width={40}
              height={40}
              borderRadius={20}
              backgroundColor={colors.primary}
              alignItems="center"
              justifyContent="center"
            >
              <Text color={colors.onPrimary} fontWeight="700" fontSize={15}>
                {patient.initials}
              </Text>
            </YStack>
            <Text fontSize={16} fontWeight="700" color={colors.textPrimary}>
              {patient.name}
            </Text>
          </XStack>

          <Pressable
            onPress={toggleTheme}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name={isDark ? 'sun' : 'moon'} size={20} color={colors.textPrimary} />
          </Pressable>
        </XStack>

        {nextMed && nextDose ? (
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              marginHorizontal: space.lg,
              marginBottom: space.section,
              borderRadius: radii.lg,
              padding: space.cardPad,
              ...shadow.hero,
            }}
          >
            <Text
              fontSize={12}
              fontWeight="700"
              letterSpacing={1}
              color={colors.onPrimary}
              opacity={0.85}
              textTransform="uppercase"
            >
              Próximo medicamento
            </Text>
            <Text fontSize={25} fontWeight="800" color={colors.onPrimary} marginTop={4}>
              {nextMed.name} · {nextMed.dosage}
            </Text>
            <Text fontSize={14.5} color={colors.onPrimary} opacity={0.85} marginTop={4}>
              {nextDoseDayLabel ? `${nextDoseDayLabel} às ${nextDose.scheduledTime}` : `às ${nextDose.scheduledTime}`}
            </Text>
            <XStack alignItems="flex-end" gap={space.sm} marginTop={space.md}>
              <Text
                fontSize={38}
                fontWeight="800"
                color={colors.onPrimary}
                fontVariant={['tabular-nums']}
              >
                {countdownLabel}
              </Text>
              <Text
                fontSize={14}
                fontWeight="600"
                color={colors.onPrimary}
                opacity={0.85}
                paddingBottom={7}
              >
                até a próxima dose
              </Text>
            </XStack>
          </LinearGradient>
        ) : (
          <YStack
            marginHorizontal={space.lg}
            marginBottom={space.section}
            borderRadius={radii.lg}
            padding={space.cardPad}
            backgroundColor={colors.surfaceAlt}
          >
            <XStack alignItems="center" gap={space.sm}>
              <Feather name="check-circle" size={22} color={colors.textSecondary} />
              <Text fontSize={17} fontWeight="700" color={colors.textPrimary}>
                Nenhuma dose pendente hoje
              </Text>
            </XStack>
            <Text fontSize={13.5} color={colors.textSecondary} marginTop={space.xs}>
              Todas as doses de hoje já foram tomadas ou não há medicamentos cadastrados.
            </Text>
          </YStack>
        )}

        <YStack
          marginHorizontal={space.lg}
          backgroundColor={colors.surface}
          borderWidth={1}
          borderColor={colors.border}
          borderRadius={radii.lg}
          padding={space.cardPadSm}
          {...shadow.card}
        >
          <XStack alignItems="center" justifyContent="space-between" marginBottom={space.md}>
            <Text
              fontSize={12.5}
              fontWeight="700"
              color={colors.textMuted}
              textTransform="uppercase"
            >
              Próximas doses
            </Text>
            <Pressable
              onPress={() => navigate('manage')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Feather name="sliders" size={13} color={colors.primary} />
              <Text fontSize={12.5} fontWeight="700" color={colors.primary}>
                Gerenciar
              </Text>
            </Pressable>
          </XStack>
          <YStack gap={2}>
            {patient.doseLog.length === 0 && (
              <Text fontSize={13.5} color={colors.textSecondary} textAlign="center" paddingVertical={12}>
                Nenhum medicamento cadastrado ainda.
              </Text>
            )}
            {patient.doseLog.map((dose) => {
              const med = getMedication(patient, dose.medicationId);
              const isNext = nextDose?.id === dose.id;
              const dayLabel = dayLabelFor(dose.scheduledAt);
              return (
                <XStack key={dose.id} gap={space.md} paddingVertical={space.sm}>
                  {iconFor(dose, isNext)}
                  <YStack flex={1}>
                    <XStack alignItems="center" justifyContent="space-between">
                      <XStack gap={space.sm} alignItems="center" flex={1} minWidth={0}>
                        <Text
                          fontSize={14.5}
                          fontWeight="700"
                          color={colors.textPrimary}
                          minWidth={44}
                        >
                          {dose.scheduledTime}
                        </Text>
                        {dayLabel && (
                          <Text
                            fontSize={11}
                            fontWeight="700"
                            color={colors.textMuted}
                            backgroundColor={colors.surfaceAlt}
                            paddingHorizontal={6}
                            paddingVertical={2}
                            borderRadius={6}
                          >
                            {dayLabel}
                          </Text>
                        )}
                        <Text
                          fontSize={16.5}
                          fontWeight="700"
                          color={colors.textPrimary}
                          flexShrink={1}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {med?.name} · {med?.dosage}
                        </Text>
                      </XStack>
                      {dose.status === 'late' && (
                        <Feather name="chevron-right" size={18} color={colors.warnText} />
                      )}
                    </XStack>
                    {dose.status === 'taken' && (
                      <Text fontSize={13} color={colors.successText} marginTop={4}>
                        Tomado às {dose.takenAt}
                      </Text>
                    )}
                    {dose.status === 'late' && (
                      <Pressable onPress={() => navigate('alert', dose.id)}>
                        <Text fontSize={13} color={colors.warnText} marginTop={4}>
                          Atrasado há {minutesLate(dose.scheduledTime)} minutos · toque para ver
                        </Text>
                      </Pressable>
                    )}
                  </YStack>
                </XStack>
              );
            })}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
