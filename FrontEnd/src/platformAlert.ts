import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a hard no-op (`static alert() {}`) —
// no dialog, no callback, nothing. Route through window.confirm/alert on web
// instead so these actually show up and fire their callback.

export function confirmDelete(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: onConfirm },
  ]);
}

export function notifyError(message: string) {
  if (Platform.OS === 'web') {
    window.alert(message);
    return;
  }
  Alert.alert('Erro', message);
}
