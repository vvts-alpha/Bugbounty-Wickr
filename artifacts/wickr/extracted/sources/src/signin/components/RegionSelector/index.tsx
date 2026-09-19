import { FC, useEffect, useState } from 'react';

import { Region } from '@/apis/webChannel/OnboardingWebChannel';
import { Button } from '@/componentlibrary';
import { SelectOption } from '@/componentlibrary/Select';
import AccessibleSelect from '@/componentlibrary/Select/AccessibleSelect';
import { useAppTranslation } from '@/lib/i18n';
import { getRegions, getSelectedRegionName, selectRegion } from '@/signin/signinThunks';
import { useAppDispatch } from '@/store';
import styles from './styles.module.less';

const RegionSelector: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const init = async () => {
      const regionsResult = await dispatch(getRegions());
      const regions = regionsResult.payload as Region[];

      if (regions?.length) {
        setOptions(
          regions.map((r) => ({
            value: r.displayName,
            label: r.displayName,
            disabled: !!r.disabled,
          }))
        );
      }

      const selectedResult = await dispatch(getSelectedRegionName());
      const selectedName = selectedResult.payload as string;

      if (selectedName) {
        setSelectedRegion(selectedName);
      }
    };

    init();
  }, [dispatch]);

  const handleChange = (value: SelectOption['value']) => {
    const region = value.toString();
    setSelectedRegion(region);
    dispatch(selectRegion(region));
  };

  return (
    <div className={styles.wrapper}>
      <Button
        className={styles.button}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span>{t('Wickr network region')}</span>
        <span className={styles.icon}>{expanded ? '−' : '+'}</span>
      </Button>
      {expanded && (
        <AccessibleSelect
          label={t('Select AWS region')}
          options={options}
          selectedOption={{
            value: selectedRegion,
            label: selectedRegion,
          }}
          onChange={handleChange}
        />
      )}
    </div>
  );
};

export default RegionSelector;
