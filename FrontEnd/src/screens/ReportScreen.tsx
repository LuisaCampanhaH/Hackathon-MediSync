import { ScrollView, YStack, XStack, Text } from 'tamagui';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeContext';
import { brandGradients, radii, shadow, space } from '../theme/tokens';
import { usePatientData } from '../data/store';
import type { Navigate } from '../../App';

const DONUT_R = 70;
const DONUT_STROKE = 18;
const DONUT_SIZE = (DONUT_R + DONUT_STROKE) * 2;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_R;
const BAR_MAX_HEIGHT = 64;

export default function ReportScreen(_props: { navigate: Navigate }) {
  const { colors } = useAppTheme();
  const { patient, weeklyAdherence, adherenceStats, streakDays } = usePatientData();
  const pct = adherenceStats.scheduled
    ? Math.round((adherenceStats.onTime / adherenceStats.scheduled) * 100)
    : 0;
  const dashLength = (pct / 100) * CIRCUMFERENCE;
  const maxTotal = Math.max(1, ...weeklyAdherence.map((d) => d.taken + d.missed));

  const cardStyle = {
    marginHorizontal: space.lg,
    marginBottom: space.md + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.cardPad,
    ...shadow.card,
  };

  return (
    <ScrollView
      backgroundColor={colors.bg}
      contentContainerStyle={{ paddingTop: 52, paddingBottom: 24 }}
    >
      <YStack paddingHorizontal={space.lg} paddingBottom={space.md + 2}>
        <Text fontSize={21} fontWeight="800" color={colors.textPrimary}>
          Relatório de Adesão
        </Text>
        <Text fontSize={13} color={colors.textSecondary} marginTop={4}>
          {patient.name} · últimos 7 dias
        </Text>
      </YStack>

      <YStack style={cardStyle} alignItems="center">
        <YStack width={DONUT_SIZE} height={DONUT_SIZE} alignItems="center" justifyContent="center" {...shadow.donut}>
          <YStack style={{ transform: [{ rotate: '-90deg' }] }}>
            <Svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
              <Defs>
                <SvgLinearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={brandGradients.donut[0]} />
                  <Stop offset="0.5" stopColor={brandGradients.donut[1]} />
                  <Stop offset="1" stopColor={brandGradients.donut[2]} />
                </SvgLinearGradient>
              </Defs>
              <Circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_R}
                fill="none"
                stroke={colors.surfaceAlt}
                strokeWidth={DONUT_STROKE}
              />
              <Circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_R}
                fill="none"
                stroke="url(#donutGrad)"
                strokeWidth={DONUT_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${dashLength.toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
              />
            </Svg>
          </YStack>
          <YStack position="absolute" alignItems="center" maxWidth={110}>
            <Text fontSize={34} fontWeight="800" color={colors.textPrimary} letterSpacing={-0.5}>
              {pct}%
            </Text>
            <Text fontSize={11.5} color={colors.textSecondary} textAlign="center" lineHeight={15}>
              das doses tomadas no horário
            </Text>
          </YStack>
        </YStack>

        <XStack gap={space.sm} marginTop={space.lg + 2} width="100%">
          {[
            ['Programadas', adherenceStats.scheduled],
            ['No horário', adherenceStats.onTime],
            ['Atrasadas', adherenceStats.late],
          ].map(([label, value]) => (
            <YStack
              key={label}
              flex={1}
              backgroundColor={colors.surfaceAlt}
              borderRadius={14}
              paddingVertical={12}
              paddingHorizontal={8}
              alignItems="center"
            >
              <Text fontSize={19} fontWeight="700" color={colors.textPrimary}>
                {value}
              </Text>
              <Text fontSize={11} color={colors.textSecondary} marginTop={2}>
                {label}
              </Text>
            </YStack>
          ))}
        </XStack>
      </YStack>

      <YStack style={cardStyle}>
        <Text fontSize={13.5} fontWeight="700" color={colors.textSecondary} marginBottom={space.md}>
          Doses por dia
        </Text>
        <XStack
          alignItems="flex-end"
          justifyContent="space-between"
          height={BAR_MAX_HEIGHT + 26}
          gap={space.xs}
        >
          {weeklyAdherence.map((day) => {
            const total = day.taken + day.missed;
            const barHeight = Math.round(8 + (total / maxTotal) * BAR_MAX_HEIGHT);
            const missedHeight = total > 0 ? Math.round((day.missed / total) * barHeight) : 0;
            const takenHeight = barHeight - missedHeight;
            return (
              <YStack
                key={day.label}
                flex={1}
                alignItems="center"
                justifyContent="flex-end"
                height="100%"
                gap={space.xs}
              >
                <Text fontSize={10.5} fontWeight="700" color={colors.textPrimary}>
                  {day.taken}/{total}
                </Text>
                <YStack width="100%" maxWidth={22} alignItems="center">
                  {missedHeight > 0 && (
                    <YStack
                      width="100%"
                      height={missedHeight}
                      backgroundColor={colors.warn}
                      borderTopLeftRadius={6}
                      borderTopRightRadius={6}
                    />
                  )}
                  {missedHeight === 0 && takenHeight > 0 ? (
                    <LinearGradient
                      colors={brandGradients.bar}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{ width: '100%', height: takenHeight, borderRadius: 6 }}
                    />
                  ) : (
                    <YStack
                      width="100%"
                      height={takenHeight}
                      backgroundColor={colors.success}
                      borderTopLeftRadius={missedHeight > 0 ? 0 : 6}
                      borderTopRightRadius={missedHeight > 0 ? 0 : 6}
                      borderBottomLeftRadius={6}
                      borderBottomRightRadius={6}
                    />
                  )}
                </YStack>
              </YStack>
            );
          })}
        </XStack>
        <XStack justifyContent="space-between" marginTop={space.sm}>
          {weeklyAdherence.map((day) => (
            <Text
              key={day.label}
              flex={1}
              textAlign="center"
              fontSize={11}
              fontWeight="600"
              color={colors.textMuted}
            >
              {day.label}
            </Text>
          ))}
        </XStack>
        <XStack gap={space.lg} marginTop={space.md} justifyContent="center">
          <XStack alignItems="center" gap={6}>
            <YStack width={10} height={10} borderRadius={5} backgroundColor={colors.success} />
            <Text fontSize={12} color={colors.textSecondary}>
              Tomado no horário
            </Text>
          </XStack>
          <XStack alignItems="center" gap={6}>
            <YStack width={10} height={10} borderRadius={5} backgroundColor={colors.warn} />
            <Text fontSize={12} color={colors.textSecondary}>
              Atrasado/omitido
            </Text>
          </XStack>
        </XStack>
      </YStack>

      <XStack
        style={cardStyle}
        backgroundColor={colors.accentTint}
        alignItems="center"
        gap={space.md}
      >
        <LinearGradient
          colors={colors.gradAction}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text fontSize={19} fontWeight="800" color={colors.onGradAction}>
            {streakDays}
          </Text>
        </LinearGradient>
        <YStack flex={1}>
          <Text fontSize={19} fontWeight="700" color={colors.accentText}>
            {streakDays} dias seguidos!
          </Text>
          <Text fontSize={13} color={colors.accentText} opacity={0.85} marginTop={2}>
            Continue assim, parabéns pela dedicação.
          </Text>
        </YStack>
      </XStack>

      <XStack
        marginHorizontal={space.lg}
        marginBottom={space.sm}
        backgroundColor={colors.primaryTint}
        borderRadius={radii.sm}
        padding={14}
        gap={space.sm}
        alignItems="flex-start"
      >
        <Feather name="info" size={20} color={colors.primary} style={{ marginTop: 2 }} />
        <Text flex={1} fontSize={13.5} color={colors.textPrimary} lineHeight={19}>
          Alta adesão ao tratamento{' '}
          <Text fontWeight="800">reduz significativamente o risco de internações</Text> por omissão
          de dose.
        </Text>
      </XStack>
    </ScrollView>
  );
}
