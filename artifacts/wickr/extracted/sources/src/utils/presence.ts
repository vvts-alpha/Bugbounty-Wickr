import { AppTranslation } from '@/lib/i18n';

export const shouldShowPresenceIcon = (timeIdle: number) => timeIdle > -1 && timeIdle < 3600;

export const getPresenceLabel = (timeIdle: number, t: AppTranslation) => {
  if (timeIdle < 900) {
    return t('Presence.Active');
  } else if (timeIdle < 1800) {
    return t('Presence.IdleForMinutes', { minutes: '15' });
  } else if (timeIdle < 2700) {
    return t('Presence.IdleForMinutes', { minutes: '30' });
  } else if (timeIdle < 3600) {
    return t('Presence.IdleForMinutes', { minutes: '45' });
  }
  return '';
};
