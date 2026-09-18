import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { ScrollView, YStack, XStack, Text } from 'tamagui';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeContext';
import { neutralGradient, radii, shadow, space } from '../theme/tokens';
import { getMedication, usePatientData, type DoseLogEntry, type Medication } from '../data/store';
import { dayBucketFor, dayWord, formatLate, minutesLate } from '../utils/time';
import type { Navigate } from '../../App';

const SOON_THRESHOLD_MS = 90 * 60 * 1000;
const ICON_SIZE = 32;

function medLabel(med?: Medication) {
  return med ? `${med.name} ${med.dosage}` : '';
}

function whenLabel(dose: DoseLogEntry) {
  const bucket = dayBucketFor(dose.scheduledAt);
  return `${dayWord(bucket, dose.scheduledAt)} às ${dose.scheduledTime}`;
}

export default function DashboardScreen({ navigate }: { navigate: Navigate }) {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const { patient, error } = usePatientData();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const lateDoses = patient.doseLog
    .filter((d) => d.status === 'late')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const pendingDoses = patient.doseLog
    .filter((d) => d.status === 'pending')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const primaryLate = lateDoses[0];
  const primaryLateMed = primaryLate ? getMedication(patient, primaryLate.medicationId) : undefined;
  const nextDose = pendingDoses[0];
  const nextMed = nextDose ? getMedication(patient, nextDose.medicationId) : undefined;

  const isOffline = !!error;
  const isUrgent = !isOffline && !!primaryLate;
  const remainingMs = nextDose ? new Date(nextDose.scheduledAt).getTime() - now : Infinity;
  const isSoon = !isOffline && !isUrgent && !!nextDose && remainingMs <= SOON_THRESHOLD_MS;

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const cmm = Math.floor(totalSeconds / 60);
  const css = totalSeconds % 60;
  const countdownLabel = `${String(cmm).padStart(2, '0')}:${String(css).padStart(2, '0')}`;

  function iconFor(dose: DoseLogEntry, isNextDose: boolean) {
    if (dose.status === 'taken') {
      return (
        <YStack
          width={ICON_SIZE}
          height={ICON_SIZE}
          borderRadius={ICON_SIZE / 2}
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
            width={ICON_SIZE}
            height={ICON_SIZE}
            borderRadius={ICON_SIZE / 2}
            borderWidth={2}
            borderColor={colors.warn}
            backgroundColor={colors.surface}
            alignItems="center"
            justifyContent="center"
          >
            <Feather name="clock" size={16} color={colors.warn} />
          </YStack>
        </Pressable>
      );
    }
    if (isNextDose) {
      return (
        <YStack
          width={ICON_SIZE}
          height={ICON_SIZE}
          borderRadius={ICON_SIZE / 2}
          backgroundColor={colors.primaryTint}
          alignItems="center"
          justifyContent="center"
        >
          <YStack width={10} height={10} borderRadius={5} backgroundColor={colors.primary} />
        </YStack>
      );
    }
    return (
      <YStack width={ICON_SIZE} height={ICON_SIZE} backgroundColor={colors.surface} alignItems="center" justifyContent="center">
        <YStack width={10} height={10} borderRadius={5} borderWidth={1.5} borderColor={colors.border} backgroundColor={colors.surface} />
      </YStack>
    );
  }

  function DoseRow({ dose }: { dose: DoseLogEntry }) {
    const med = getMedication(patient, dose.medicationId);
    const isNextDose = nextDose?.id === dose.id;
    const statusLabel =
      dose.status === 'taken'
        ? `Tomado às ${dose.takenAt}`
        : dose.status === 'late'
          ? `Atrasado ${formatLate(minutesLate(dose.scheduledTime))}`
          : isNextDose
            ? 'Próxima dose'
            : 'Programado';

    return (
      <XStack gap={space.md} paddingVertical={space.sm} alignItems="center">
        {iconFor(dose, isNextDose)}
        <YStack flex={1} minWidth={0}>
          <XStack alignItems="center" justifyContent="space-between">
            <XStack gap={space.sm} alignItems="center" flex={1} minWidth={0}>
              <Text
                fontSize={14.5}
                fontWeight="700"
                color={dose.status === 'late' ? colors.warnText : colors.textPrimary}
                minWidth={44}
              >
                {dose.scheduledTime}
              </Text>
              <Text
                fontSize={16.5}
                fontWeight="700"
                color={colors.textPrimary}
                flexShrink={1}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {medLabel(med)}
              </Text>
            </XStack>
            {dose.status === 'late' && <Feather name="chevron-right" size={18} color={colors.textMuted} />}
          </XStack>
          <Text fontSize={13} color={colors.textSecondary} marginTop={4}>
            {statusLabel}
          </Text>
        </YStack>
      </XStack>
    );
  }

  function DayGroup({ title, summary, doses }: { title: string; summary: string; doses: DoseLogEntry[] }) {
    if (doses.length === 0) return null;
    return (
      <YStack marginBottom={space.md}>
        <XStack alignItems="center" justifyContent="space-between" marginBottom={space.sm}>
          <Text fontSize={12.5} fontWeight="700" color={colors.textMuted} textTransform="uppercase">
            {title}
          </Text>
          <Text fontSize={12.5} fontWeight="600" color={colors.textMuted}>
            {summary}
          </Text>
        </XStack>
        <YStack position="relative">
          {doses.length > 1 && (
            <YStack position="absolute" left={ICON_SIZE / 2 - 1} top={16} bottom={16} width={2} backgroundColor={colors.border} />
          )}
          {doses.map((dose) => (
            <DoseRow key={dose.id} dose={dose} />
          ))}
        </YStack>
      </YStack>
    );
  }

  const todayDoses = patient.doseLog.filter((d) => dayBucketFor(d.scheduledAt) === 'today');
  const tomorrowDoses = patient.doseLog.filter((d) => dayBucketFor(d.scheduledAt) === 'tomorrow');
  const todayTakenCount = todayDoses.filter((d) => d.status === 'taken').length;

  function renderHero() {
    if (isOffline) {
      return (
        <YStack
          marginHorizontal={space.lg}
          marginBottom={space.section}
          borderRadius={radii.lg}
          padding={space.cardPad}
          backgroundColor={colors.surfaceAlt}
        >
          <XStack alignItems="center" gap={space.sm}>
            <Feather name="wifi-off" size={22} color={colors.textSecondary} />
            <Text fontSize={17} fontWeight="700" color={colors.textPrimary}>
              Agenda indisponível
            </Text>
          </XStack>
          <Text fontSize={13.5} color={colors.textSecondary} marginTop={space.xs}>
            Sem conexão com o servidor no momento. Verifique sua internet e tente novamente.
          </Text>
        </YStack>
      );
    }

    if (isUrgent && primaryLate) {
      return (
        <LinearGradient
          colors={colors.gradAlert}
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
          <Text fontSize={12} fontWeight="700" letterSpacing={1} color={colors.onWarn} opacity={0.9} textTransform="uppercase">
            REQUER ATENÇÃO AGORA
          </Text>
          <Text fontSize={25} fontWeight="800" color={colors.onWarn} marginTop={4}>
            {medLabel(primaryLateMed)}
          </Text>
          <Text fontSize={14.5} color={colors.onWarn} opacity={0.9} marginTop={4}>
            Atrasado {formatLate(minutesLate(primaryLate.scheduledTime))}
            {lateDoses.length > 1 ? ` · +${lateDoses.length - 1} outras doses atrasadas` : ''}
          </Text>
          <Pressable onPress={() => navigate('alert', primaryLate.id)} style={{ marginTop: space.md }}>
            <YStack backgroundColor={colors.onWarn} borderRadius={14} paddingVertical={14} alignItems="center">
              <Text color={colors.alertPrimaryBg} fontSize={16} fontWeight="700">
                Resolver agora
              </Text>
            </YStack>
          </Pressable>
          {nextDose && nextMed && (
            <>
              <YStack height={1} backgroundColor="rgba(255,255,255,0.3)" marginVertical={space.md} />
              <Text fontSize={13} color={colors.onWarn} opacity={0.9}>
                Próxima dose: {medLabel(nextMed)}, {whenLabel(nextDose)}
              </Text>
            </>
          )}
        </LinearGradient>
      );
    }

    if (nextDose && nextMed) {
      const bucket = dayBucketFor(nextDose.scheduledAt);
      return (
        <LinearGradient
          colors={colors.gradHero}
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
          <Text fontSize={12} fontWeight="700" letterSpacing={1} color={colors.onPrimary} opacity={0.85} textTransform="uppercase">
            PRÓXIMA DOSE
          </Text>
          <Text fontSize={25} fontWeight="800" color={colors.onPrimary} marginTop={4}>
            {medLabel(nextMed)}
          </Text>
          {isSoon ? (
            <XStack alignItems="flex-end" gap={space.sm} marginTop={space.md}>
              <Text fontSize={38} fontWeight="800" color={colors.onPrimary} fontVariant={['tabular-nums']}>
                {countdownLabel}
              </Text>
              <Text fontSize={14} fontWeight="600" color={colors.onPrimary} opacity={0.85} paddingBottom={7}>
                até a dose
              </Text>
            </XStack>
          ) : (
            <XStack alignItems="flex-end" gap={space.sm} marginTop={space.md}>
              <Text fontSize={40} fontWeight="800" color={colors.onPrimary}>
                {nextDose.scheduledTime}
              </Text>
              <Text fontSize={14} fontWeight="600" color={colors.onPrimary} opacity={0.85} paddingBottom={9}>
                {dayWord(bucket, nextDose.scheduledAt)}
              </Text>
            </XStack>
          )}
        </LinearGradient>
      );
    }

    return (
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
    );
  }

  return (
    <YStack flex={1} position="relative">
      <ScrollView backgroundColor={colors.bg} contentContainerStyle={{ paddingTop: 52, paddingBottom: 12 }}>
        <XStack paddingHorizontal={space.lg} paddingBottom={space.section} alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap={10}>
            <LinearGradient
              colors={colors.gradAction}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text color={colors.onAvatarGrad} fontWeight="700" fontSize={15}>
                {patient.initials}
              </Text>
            </LinearGradient>
            <Text fontSize={16} fontWeight="700" color={colors.textPrimary}>
              {patient.name}
            </Text>
          </XStack>

          <Pressable onPress={toggleTheme}>
            <LinearGradient
              colors={neutralGradient(colors)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name={isDark ? 'sun' : 'moon'} size={20} color={colors.textPrimary} />
            </LinearGradient>
          </Pressable>
        </XStack>

        {renderHero()}

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
            <Text fontSize={12.5} fontWeight="700" color={colors.textMuted} textTransform="uppercase">
              Próximas doses
            </Text>
            <Pressable onPress={() => navigate('manage')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="sliders" size={13} color={colors.primary} />
              <Text fontSize={12.5} fontWeight="700" color={colors.primary}>
                Gerenciar
              </Text>
            </Pressable>
          </XStack>
          {patient.doseLog.length === 0 && (
            <Text fontSize={13.5} color={colors.textSecondary} textAlign="center" paddingVertical={12}>
              Nenhum medicamento cadastrado ainda.
            </Text>
          )}
          <DayGroup title="Hoje" summary={`${todayTakenCount} de ${todayDoses.length} tomadas`} doses={todayDoses} />
          <DayGroup title="Amanhã" summary={`${tomorrowDoses.length} doses`} doses={tomorrowDoses} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
