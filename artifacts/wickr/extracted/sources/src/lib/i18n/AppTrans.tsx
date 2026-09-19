import React from 'react';
// eslint-disable-next-line no-restricted-imports
import { Trans } from 'react-i18next';
import { TranslationKey } from '@/lib/i18n';

type TransProps = ComponentProps<typeof Trans>;
type AppTransProps = Omit<TransProps, 'i18nKey'> & { i18nKey: TranslationKey };

const AppTrans: React.FC<AppTransProps> = (props) => {
  return <Trans {...(props as any)} />;
};

export default AppTrans;
