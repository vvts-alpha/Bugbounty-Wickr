import { FC } from 'react';
import ConnectionStatus from '@/components/Banners/BannerComponents/ConnectionStatus';
import CrossBoundaryClassification from '@/components/Banners/BannerComponents/CrossBoundaryClassification';
import FileTransferBanners from '@/components/Banners/BannerComponents/FileTransferBanners';
import MlsSyncing from '@/components/Banners/BannerComponents/MlsSyncing';
import ModeratorTip from '@/components/Banners/BannerComponents/ModeratorTip';
import SecurityStatusChangeWarning from '@/components/Banners/BannerComponents/SecurityStatusChangeWarning';
import { useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectActiveTab } from '@/store/slices/uiChat';

import styles from './styles.module.less';

const ConvoBannersContainer: FC = () => {
  const activeTab = useAppSelector(selectActiveTab);
  const mlsEnabled = useSetting('mlsEnabled');

  return (
    <div className={styles.bannersContainer}>
      <CrossBoundaryClassification />
      <ConnectionStatus />
      {activeTab === 'messages' && (
        <>
          <SecurityStatusChangeWarning />
          <ModeratorTip />
          <FileTransferBanners />
          {mlsEnabled && <MlsSyncing />}
        </>
      )}
    </div>
  );
};

export default ConvoBannersContainer;
