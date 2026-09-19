import { FC, useEffect } from 'react';
import AWSWickrLogo from '@/components/AWSWickrLogo';
import WickrEnterpriseLogo from '@/components/WickrEnterpriseLogo';
import { Logger } from '@/lib/logger';
import { SigninAppSubscriptions } from '@/signin/components/SigninAppSubscriptions';
import { SigninRoutes } from '@/signin/routes';
import { clearSigninState } from '@/signin/signinSlice';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setUIAppName } from '@/store/slices/uiApp';
import { fetchAppProperties, fetchAppStage } from '@/store/thunks/settings';

import styles from './SigninContainer.module.less';

const logger = new Logger('SigninContainer');

export const SigninContainer: FC = () => {
  const isEnterprise = useSetting('isEnterprise');
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setUIAppName('signin'));
  }, [dispatch]);

  useEffect(() => {
    logger.info('Dispatching signin app');
    dispatch(fetchAppStage());
    dispatch(fetchAppProperties());

    return () => {
      logger.info('Exiting signin app');
      dispatch(clearSigninState());
    };
  }, [dispatch]);

  return (
    <>
      <SigninAppSubscriptions />
      <div className={styles.signinContainer}>
        <div className={styles.wickrLogo}>
          {isEnterprise ? <WickrEnterpriseLogo /> : <AWSWickrLogo />}
        </div>
        <SigninRoutes />
      </div>
    </>
  );
};
