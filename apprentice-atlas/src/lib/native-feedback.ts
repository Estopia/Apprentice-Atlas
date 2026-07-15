const isWeb = () => process.env.EXPO_OS === 'web';

async function runHaptic(kind: 'selection' | 'success' | 'error'): Promise<void> {
  if (isWeb()) return;

  try {
    const Haptics = await import('expo-haptics');
    if (kind === 'selection') {
      await Haptics.selectionAsync();
      return;
    }

    await Haptics.notificationAsync(
      kind === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
  } catch {
    // Feedback must never block or fail the user action it accompanies.
  }
}

export const selectionFeedback = () => runHaptic('selection');
export const successFeedback = () => runHaptic('success');
export const errorFeedback = () => runHaptic('error');
