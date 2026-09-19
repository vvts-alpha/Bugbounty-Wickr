/**
 * Module-level guard that is set synchronously before bridge.signOut() is called
 * and cleared after the signOut thunk completes.
 *
 * This prevents re-entrant signOut() calls: the native side can emit
 * onboardingPageChanged(EnterEmail) in response to bridge.signOut(), and
 * OnboardingSubscriptions would otherwise dispatch a second signOut() because
 * uiAppName is still 'chat' at that point (React hasn't re-rendered yet).
 */
export const signingOutGuard = { current: false };
