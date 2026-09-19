import { FC, useMemo } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalButtonGroup,
  Button,
  PrimaryButton,
  List,
  ListItem,
  Toggle,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppStorage } from '@/lib/storage/AppStorageProvider';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectAllFeatureConfigs,
  selectAllFeaturesEnabled,
  selectAllLocalFeatureOverrides,
  selectAvailableExperiments,
} from '@/store/slices/features';
import { clearAllTourProgress } from '@/store/thunks/coachMarks';
import {
  resetLocalFeatureOverrides,
  updatePreviousLabFeatures,
  updateLocalFeatureOverrides,
} from '@/store/thunks/features';
import { closeModal, openAlertModal } from '@/store/thunks/modals';
import { setShowWebViewImmediately } from '@/store/thunks/settings';
import styles from './styles.module.less';

const LabFeatureModal: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const store = useAppStore();
  const appStorage = useAppStorage();
  const isProduction = useSetting('isProduction');
  const wickrAIEnabled = useFeature('WickrAI');
  const previousLabFeatures = useAppSelector((state) => state.features.previousLabFeatures);
  const configs = useAppSelector(selectAllFeatureConfigs);
  const enabledFeatures = useAppSelector(selectAllFeaturesEnabled);
  const labs = useAppSelector(selectAvailableExperiments);

  // Calculate new features since last app restart
  const newFeaturesSet = new Set(labs.filter((lab) => !previousLabFeatures.includes(lab)));

  // Sort by dateAdded
  const sortedLabs = useMemo(
    () =>
      labs.slice().sort((a, b) => {
        const dateA = configs[a].dateAdded;
        const dateB = configs[b].dateAdded;
        return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
      }),
    [labs, configs]
  );

  if (isProduction || !labs.length) return null;

  const handleClose = () => {
    dispatch(updatePreviousLabFeatures(labs));
    dispatch(closeModal('LabFeatureModal'));
  };

  return (
    <Modal onClose={handleClose} size="md">
      <ModalHeader title="Wickr Labs" />
      <ModalBody>
        <List>
          <ListItem>
            <p>
              Preview experimental features. These features are not production ready and are{' '}
              <em>only visible internally</em> for testing and feedback.
            </p>
          </ListItem>
          {sortedLabs.map((featureName) => {
            const enabled = enabledFeatures[featureName];
            const { title, description, availability, dateAdded } = configs[featureName];

            const handleClick = () => {
              if (featureName === 'Signin') {
                dispatch(setShowWebViewImmediately(!enabled));
              } else {
                if (featureName === 'Tours' && !enabled) {
                  dispatch(clearAllTourProgress());
                }
                dispatch(updateLocalFeatureOverrides({ [featureName]: !enabled }));
              }
            };
            return (
              <ListItem key={featureName} className={styles.listItem}>
                <Toggle
                  label={featureName}
                  onClick={handleClick}
                  aria-disabled={featureName === 'WickrAIChat' && !wickrAIEnabled}
                  checked={enabled}
                />
                <div className={styles.clickable} onClick={handleClick}>
                  <h3>
                    {title}
                    <span className={styles.availableBadge}>({availability})</span>
                    {newFeaturesSet.has(featureName) && (
                      <span className={styles.newBadge}>NEW</span>
                    )}
                  </h3>
                  <p>
                    {description}{' '}
                    <small>
                      (Added:{' '}
                      {t('Intl.DateTime', {
                        val: new Date(dateAdded),
                      })}
                      )
                    </small>
                  </p>
                </div>
              </ListItem>
            );
          })}
        </List>
      </ModalBody>
      <ModalButtonGroup>
        <Button
          onClick={async () => {
            const mem = selectAllLocalFeatureOverrides(store.getState());
            const storage = await appStorage.get('LocalFeatures', {});
            function toString([name, enabled]: [string, boolean]) {
              return `\n  ${name}: ${enabled ? 'true' : 'false'}`;
            }
            dispatch(
              openAlertModal({
                title: 'State',
                body:
                  `In memory: ${Object.entries(mem).map(toString)}\n\n` +
                  `App storage: ${Object.entries(storage).map(toString)}`,
              })
            );
          }}
        >
          Debug State
        </Button>
        <Button
          onClick={() => {
            // close first, because close updates similar state
            handleClose();
            dispatch(updatePreviousLabFeatures([]));
            dispatch(resetLocalFeatureOverrides());
          }}
          color="red"
        >
          Reset State
        </Button>
        <PrimaryButton onClick={handleClose}>Close</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default LabFeatureModal;
