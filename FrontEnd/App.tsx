import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider, YStack, XStack, Text } from 'tamagui';
import { ActivityIndicator, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import tamaguiConfig from './tamagui.config';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { space } from './src/theme/tokens';
import { PatientDataProvider, usePatientData } from './src/data/store';
import { setupNotifications } from './src/notifications';

import ScreenTransition from './src/components/ScreenTransition';
import WebNotificationModal from './src/components/WebNotificationModal';
import DashboardScreen from './src/screens/DashboardScreen';
import AddMedicationScreen from './src/screens/AddMedicationScreen';
import ManageMedicationsScreen from './src/screens/ManageMedicationsScreen';
import AlertScreen from './src/screens/AlertScreen';
import ReportScreen from './src/screens/ReportScreen';

export type ScreenName = 'dashboard' | 'add' | 'manage' | 'alert' | 'report';

export type Navigate = (screen: ScreenName, doseId?: string, medicationId?: string) => void;

function AppShell() {
  const { colors, isDark } = useAppTheme();
  const { loading, error, refresh, webNotification, dismissWebNotification } = usePatientData();

  const [screen, setScreen] = useState<ScreenName>('dashboard');
  const [alertDoseId, setAlertDoseId] = useState<string | undefined>();
  const [editMedicationId, setEditMedicationId] = useState<string | undefined>();

  const navigate: Navigate = (next, doseId, medicationId) => {
    if (doseId) setAlertDoseId(doseId);
    setEditMedicationId(medicationId);
    setScreen(next);
  };

  useEffect(() => {
    setupNotifications();
  }, []);

  if (loading) {
    return (
      <YStack flex={1} backgroundColor={colors.bg} alignItems="center" justifyContent="center" gap={space.md}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text fontSize={14.5} color={colors.textSecondary}>
          Carregando dados do servidor...
        </Text>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack
        flex={1}
        backgroundColor={colors.bg}
        alignItems="center"
        justifyContent="center"
        gap={space.md}
        paddingHorizontal={space.lg}
      >
        <Feather name="wifi-off" size={32} color={colors.textSecondary} />
        <Text fontSize={16} fontWeight="700" color={colors.textPrimary} textAlign="center">
          Não foi possível falar com o servidor
        </Text>
        <Text fontSize={13.5} color={colors.textSecondary} textAlign="center">
          {error}
        </Text>
        <Pressable onPress={() => refresh()}>
          <YStack
            backgroundColor={colors.primary}
            borderRadius={12}
            paddingHorizontal={20}
            paddingVertical={12}
          >
            <Text color={colors.onPrimary} fontWeight="700">
              Tentar novamente
            </Text>
          </YStack>
        </Pressable>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={colors.bg}>
      <YStack flex={1}>
        {screen === 'dashboard' && (
          <ScreenTransition key="dashboard">
            <DashboardScreen navigate={navigate} />
          </ScreenTransition>
        )}
        {screen === 'add' && (
          <ScreenTransition key={`add-${editMedicationId ?? 'new'}`}>
            <AddMedicationScreen navigate={navigate} medicationId={editMedicationId} />
          </ScreenTransition>
        )}
        {screen === 'manage' && (
          <ScreenTransition key="manage">
            <ManageMedicationsScreen navigate={navigate} />
          </ScreenTransition>
        )}
        {screen === 'alert' && (
          <ScreenTransition key="alert">
            <AlertScreen navigate={navigate} doseId={alertDoseId} />
          </ScreenTransition>
        )}
        {screen === 'report' && (
          <ScreenTransition key="report">
            <ReportScreen navigate={navigate} />
          </ScreenTransition>
        )}
      </YStack>

      {screen !== 'alert' && (
        <XStack
          alignItems="stretch"
          justifyContent="space-around"
          backgroundColor={colors.surface}
          borderTopWidth={1}
          borderTopColor={colors.border}
          paddingHorizontal={space.sm}
          paddingTop={space.sm}
          paddingBottom={30}
        >
          <Pressable
            onPress={() => setScreen('dashboard')}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: 52,
            }}
          >
            <Feather
              name="home"
              size={23}
              color={screen === 'dashboard' ? colors.primary : colors.tabInactive}
            />
            <Text
              fontSize={11}
              fontWeight={screen === 'dashboard' ? '700' : '600'}
              color={screen === 'dashboard' ? colors.primary : colors.tabInactive}
            >
              Início
            </Text>
          </Pressable>

          <YStack flex={1} alignItems="center" justifyContent="flex-start">
            <Pressable
              onPress={() => setScreen('add')}
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                marginTop: -30,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: colors.surface,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.22,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Feather name="plus" size={23} color={colors.onPrimary} />
            </Pressable>
            <Text fontSize={11} fontWeight="700" color={colors.textSecondary} marginTop={2}>
              Adicionar
            </Text>
          </YStack>

          <Pressable
            onPress={() => setScreen('report')}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: 52,
            }}
          >
            <Feather
              name="bar-chart-2"
              size={23}
              color={screen === 'report' ? colors.primary : colors.tabInactive}
            />
            <Text
              fontSize={11}
              fontWeight={screen === 'report' ? '700' : '600'}
              color={screen === 'report' ? colors.primary : colors.tabInactive}
            >
              Relatórios
            </Text>
          </Pressable>
        </XStack>
      )}

      <StatusBar style={isDark ? 'light' : 'dark'} />
      <WebNotificationModal notification={webNotification} onDismiss={dismissWebNotification} />
    </YStack>
  );
}

export default function App() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ThemeProvider>
        <PatientDataProvider>
          <AppShell />
        </PatientDataProvider>
      </ThemeProvider>
    </TamaguiProvider>
  );
}
