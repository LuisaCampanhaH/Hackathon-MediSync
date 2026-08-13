import { Modal, Pressable } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Feather } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeContext';
import { radii, space, shadow } from '../theme/tokens';
import type { WebNotification } from '../data/store';

// react-native-web não tem notificação push nativa (Notifications.* é
// no-op na web) — esse modal é o substituto visual pros eventos que chegam
// via WebSocket (nova_dose_registrada) quando rodando no browser.
export default function WebNotificationModal({
  notification,
  onDismiss,
}: {
  notification: WebNotification | null;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  if (!notification) return null;

  const isWarning = notification.status === 'Atrasado' || notification.status === 'Nao Tomado';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.lg,
        }}
      >
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380 }}>
          <YStack
            backgroundColor={colors.surface}
            borderRadius={radii.lg}
            borderWidth={1}
            borderColor={colors.border}
            padding={space.cardPad}
            gap={space.md}
            alignItems="center"
            {...shadow.dropdown}
          >
            <YStack
              width={64}
              height={64}
              borderRadius={22}
              backgroundColor={isWarning ? colors.warnTint : colors.successTint}
              alignItems="center"
              justifyContent="center"
            >
              <Feather
                name={isWarning ? 'alert-triangle' : 'check-circle'}
                size={30}
                color={isWarning ? colors.warn : colors.success}
              />
            </YStack>

            <Text fontSize={19} fontWeight="800" color={colors.textPrimary} textAlign="center">
              {notification.title}
            </Text>
            <Text fontSize={15} lineHeight={22} color={colors.textSecondary} textAlign="center">
              {notification.message}
            </Text>

            <Pressable onPress={onDismiss} style={{ width: '100%' }}>
              <XStack
                minHeight={50}
                borderRadius={radii.squircle}
                backgroundColor={colors.primary}
                alignItems="center"
                justifyContent="center"
              >
                <Text color={colors.onPrimary} fontSize={15.5} fontWeight="700">
                  Ok, entendi
                </Text>
              </XStack>
            </Pressable>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
