import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, TextInput } from 'react-native';
import { ScrollView, YStack, XStack, Text } from 'tamagui';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useAppTheme } from '../theme/ThemeContext';
import { radii, shadow, space } from '../theme/tokens';
import { getMedication, usePatientData } from '../data/store';
import type { Navigate, ScreenName } from '../../App';

const FREQUENCIES = ['1x ao dia', '2x ao dia', '3x ao dia', 'A cada 8h', 'Outro'];

function inputStyle(colors: ReturnType<typeof useAppTheme>['colors']) {
  return {
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.textPrimary,
  };
}

export default function AddMedicationScreen({
  navigate,
  medicationId,
}: {
  navigate: Navigate;
  medicationId?: string;
}) {
  const { colors, isDark } = useAppTheme();
  const { patient, addMedication, updateMedication } = usePatientData();
  const existing = medicationId ? getMedication(patient, medicationId) : undefined;
  const backTarget: ScreenName = medicationId ? 'manage' : 'dashboard';

  const [name, setName] = useState(existing?.name ?? '');
  const [dosage, setDosage] = useState(existing?.dosage ?? '');
  const [freq, setFreq] = useState(FREQUENCIES[0]);
  const [customFreq, setCustomFreq] = useState('');
  const [times, setTimes] = useState<string[]>(existing?.times ?? []);
  const [stock, setStock] = useState(existing?.stock ?? 30);
  const [draftTime, setDraftTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const canSave = name.trim().length > 0 && !saving;

  function confirmTime(date: Date) {
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    setTimes((prev) => (prev.includes(time) ? prev : [...prev, time].sort()));
    setShowPicker(false);
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      // Android's picker is a modal dialog with its own OK/Cancel — it only
      // reports back once, on dismiss, so add the time right here.
      setShowPicker(false);
      if (event.type === 'set' && selected) confirmTime(selected);
      return;
    }
    // iOS's picker is an inline spinner that fires continuously while
    // scrolling — just track the in-progress value, add on explicit confirm.
    if (selected) setDraftTime(selected);
  }

  function removeTime(time: string) {
    setTimes((prev) => prev.filter((t) => t !== time));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const input = {
      name: name.trim(),
      dosage: dosage.trim(),
      stock,
      times: times.length ? times : ['08:00'],
    };
    try {
      if (medicationId) {
        await updateMedication(medicationId, input);
      } else {
        await addMedication(input);
      }
      setToastVisible(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível salvar o medicamento.';
      // Alert.alert não mostra nada no react-native-web.
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Erro', msg);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!toastVisible) return;
    Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const id = setTimeout(() => navigate(backTarget), 1300);
    return () => clearTimeout(id);
    // navigate is a fresh closure every render; only toastVisible should retrigger this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastVisible]);

  return (
    <YStack flex={1} backgroundColor={colors.bg} position="relative">
      <ScrollView contentContainerStyle={{ paddingTop: 52, paddingBottom: 40 }}>
        <XStack
          paddingHorizontal={space.lg}
          paddingBottom={space.section}
          alignItems="center"
          gap={14}
        >
          <Pressable
            onPress={() => navigate(backTarget)}
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
              {medicationId ? 'Editar Medicamento' : 'Novo Medicamento'}
            </Text>
            <Text fontSize={13} color={colors.textSecondary}>
              Para {patient.name}
            </Text>
          </YStack>
        </XStack>

        <YStack paddingHorizontal={space.lg} gap={space.lg}>
          <YStack gap={space.xs}>
            <Text fontSize={13.5} fontWeight="700" color={colors.textSecondary}>
              Nome do remédio
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Losartana"
              placeholderTextColor={colors.textMuted}
              style={inputStyle(colors)}
            />
          </YStack>

          <YStack gap={space.xs}>
            <Text fontSize={13.5} fontWeight="700" color={colors.textSecondary}>
              Dosagem
            </Text>
            <TextInput
              value={dosage}
              onChangeText={setDosage}
              placeholder="Ex: 50mg"
              placeholderTextColor={colors.textMuted}
              style={inputStyle(colors)}
            />
          </YStack>

          <YStack gap={space.sm}>
            <Text fontSize={13.5} fontWeight="700" color={colors.textSecondary}>
              Frequência
            </Text>
            <XStack flexWrap="wrap" gap={space.sm}>
              {FREQUENCIES.map((f) => {
                const selected = f === freq;
                return (
                  <Pressable key={f} onPress={() => setFreq(f)}>
                    <YStack
                      borderRadius={radii.sm}
                      paddingHorizontal={14}
                      paddingVertical={10}
                      backgroundColor={selected ? colors.primary : colors.surfaceAlt}
                    >
                      <Text
                        fontSize={13.5}
                        fontWeight={selected ? '700' : '600'}
                        color={selected ? colors.onPrimary : colors.textPrimary}
                      >
                        {f}
                      </Text>
                    </YStack>
                  </Pressable>
                );
              })}
            </XStack>
            {freq === 'Outro' && (
              <TextInput
                value={customFreq}
                onChangeText={setCustomFreq}
                placeholder="Especifique, ex: a cada 6 horas"
                placeholderTextColor={colors.textMuted}
                style={[inputStyle(colors), { minHeight: 48, fontSize: 15 }]}
              />
            )}
          </YStack>

          <YStack gap={space.sm}>
            <Text fontSize={13.5} fontWeight="700" color={colors.textSecondary}>
              Horário(s) de disparo
            </Text>
            {times.length > 0 && (
              <XStack flexWrap="wrap" gap={space.sm}>
                {times.map((time) => (
                  <XStack
                    key={time}
                    alignItems="center"
                    gap={space.sm}
                    backgroundColor={colors.surfaceAlt}
                    borderRadius={radii.pill}
                    paddingHorizontal={14}
                    paddingVertical={8}
                  >
                    <Text color={colors.textPrimary} fontWeight="700" fontSize={14}>
                      {time}
                    </Text>
                    {times.length > 1 && (
                      <Pressable
                        onPress={() => removeTime(time)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name="x" size={13} color={colors.textPrimary} />
                      </Pressable>
                    )}
                  </XStack>
                ))}
              </XStack>
            )}

            {!showPicker && (
              <Pressable
                onPress={() => {
                  setDraftTime(new Date());
                  setShowPicker(true);
                }}
              >
                <XStack
                  alignItems="center"
                  justifyContent="center"
                  gap={space.sm}
                  borderRadius={radii.md}
                  borderWidth={1.5}
                  borderColor={colors.primary}
                  borderStyle="dashed"
                  paddingVertical={14}
                >
                  <Feather name="plus" size={15} color={colors.primary} />
                  <Text color={colors.primary} fontWeight="700" fontSize={14}>
                    Adicionar horário
                  </Text>
                </XStack>
              </Pressable>
            )}

            {showPicker && (
              <YStack
                backgroundColor={colors.surfaceAlt}
                borderRadius={radii.md}
                padding={space.md}
                gap={space.md}
              >
                <Text
                  fontSize={13.5}
                  fontWeight="700"
                  color={colors.textSecondary}
                  textAlign="center"
                >
                  Escolha o horário e confirme
                </Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="time"
                    value={`${String(draftTime.getHours()).padStart(2, '0')}:${String(draftTime.getMinutes()).padStart(2, '0')}`}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':').map(Number);
                      if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
                      const next = new Date(draftTime);
                      next.setHours(hours, minutes);
                      setDraftTime(next);
                    }}
                    style={{
                      fontSize: 17,
                      padding: 14,
                      borderRadius: radii.md,
                      border: `1.5px solid ${colors.primary}`,
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                    }}
                  />
                ) : (
                  <DateTimePicker
                    value={draftTime}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onPickerChange}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                )}
                {Platform.OS !== 'android' && (
                  <XStack gap={space.sm}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowPicker(false)}>
                      <YStack
                        alignItems="center"
                        justifyContent="center"
                        minHeight={48}
                        borderRadius={radii.sm}
                        backgroundColor={colors.surface}
                      >
                        <Text color={colors.textPrimary} fontWeight="700" fontSize={14.5}>
                          Cancelar
                        </Text>
                      </YStack>
                    </Pressable>
                    <Pressable style={{ flex: 1 }} onPress={() => confirmTime(draftTime)}>
                      <YStack
                        alignItems="center"
                        justifyContent="center"
                        minHeight={48}
                        borderRadius={radii.sm}
                        backgroundColor={colors.primary}
                      >
                        <Text color={colors.onPrimary} fontWeight="700" fontSize={14.5}>
                          Confirmar horário
                        </Text>
                      </YStack>
                    </Pressable>
                  </XStack>
                )}
              </YStack>
            )}
          </YStack>

          <YStack gap={space.sm}>
            <Text fontSize={13.5} fontWeight="700" color={colors.textSecondary}>
              Estoque na caixinha
            </Text>
            <XStack
              alignItems="center"
              gap={space.md}
              backgroundColor={colors.surfaceAlt}
              borderRadius={radii.md}
              paddingHorizontal={16}
              paddingVertical={10}
              alignSelf="flex-start"
            >
              <Pressable
                onPress={() => setStock((s) => Math.max(0, s - 1))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="minus" size={17} color={colors.textPrimary} />
              </Pressable>
              <Text
                fontSize={24}
                fontWeight="700"
                color={colors.textPrimary}
                minWidth={40}
                textAlign="center"
              >
                {stock}
              </Text>
              <Pressable
                onPress={() => setStock((s) => s + 1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="plus" size={17} color={colors.textPrimary} />
              </Pressable>
            </XStack>
            <Text fontSize={12.5} color={colors.textMuted}>
              Quantidade de comprimidos inseridos no hardware.
            </Text>
          </YStack>

          <YStack gap={space.sm}>
            <Pressable onPress={handleSave} disabled={!canSave}>
              <YStack
                alignItems="center"
                justifyContent="center"
                minHeight={58}
                borderRadius={radii.md}
                backgroundColor={colors.primary}
                opacity={canSave ? 1 : 0.5}
                {...shadow.hero}
              >
                <Text color={colors.onPrimary} fontSize={17} fontWeight="700">
                  {saving ? 'Salvando...' : medicationId ? 'Salvar Alterações' : 'Salvar Configuração'}
                </Text>
              </YStack>
            </Pressable>
            <Text fontSize={12.5} color={colors.textMuted} textAlign="center">
              A configuração será enviada para a caixinha via Wi-Fi.
            </Text>
          </YStack>
        </YStack>
      </ScrollView>

      {toastVisible && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 54,
            left: space.lg,
            right: space.lg,
            opacity: toastAnim,
            transform: [
              { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
            ],
          }}
        >
          <XStack
            alignItems="center"
            justifyContent="center"
            gap={space.sm}
            backgroundColor={colors.successTint}
            borderRadius={radii.pill}
            paddingVertical={14}
          >
            <Feather name="check" size={16} color={colors.successText} />
            <Text fontSize={14.5} fontWeight="700" color={colors.successText}>
              {medicationId
                ? 'Medicamento atualizado com sucesso'
                : 'Medicamento salvo com sucesso'}
            </Text>
          </XStack>
        </Animated.View>
      )}
    </YStack>
  );
}
