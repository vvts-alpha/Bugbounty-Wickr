import { ConvoMuteOptions } from '@/store/slices/convos';

export const ONE_HOUR_SECONDS = 60 * 60;
export const EIGHT_HOUR_SECONDS = 60 * 60 * 8;
export const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;
export const OFF_VALUE = 0;

type MuteDurationKey = 3600 | 28800 | 604800 | '-1';

export const convoMuteOptionsMap: Record<MuteDurationKey, ConvoMuteOptions> = {
  3600: '1 hour',
  28800: '8 hours',
  604800: '1 week',
  '-1': 'Always',
};

export const getMuteDurationSecondsByLabel = (value: ConvoMuteOptions) => {
  const key = (Object.keys(convoMuteOptionsMap) as Array<MuteDurationKey>).find(
    (key) => convoMuteOptionsMap[key] === value
  );

  return key ? Number(key) : OFF_VALUE;
};
