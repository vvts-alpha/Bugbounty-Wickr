import { LocationIcon, ExternalLink } from '@/componentlibrary';
import AppTrans from '@/lib/i18n/AppTrans';
import { getGoogleMapsLocationUrl } from '@/utils/geoLocation';

import styles from './ConvoMessageLocationText.module.less';

interface Props {
  latitude: number;
  longitude: number;
}
const ConvoMessageLocationText: React.FC<Props> = ({ latitude, longitude }) => {
  const locationUrl = getGoogleMapsLocationUrl(latitude, longitude);

  return (
    <div className={styles.convoMessageLocationText}>
      <LocationIcon className={styles.icon} filled={true} size="24" />
      <p>
        <AppTrans i18nKey="I sent my location: <0>{{url}}</0>" values={{ url: locationUrl }}>
          <ExternalLink href={locationUrl}></ExternalLink>
        </AppTrans>
      </p>
    </div>
  );
};

export default ConvoMessageLocationText;
