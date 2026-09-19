import { clsx } from 'clsx';
import truncate from 'lodash/truncate';
import { Fragment } from 'react';
import { Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectActiveFileItemBreadcrumbs,
  selectFileItemBreadcrumbsById,
} from '@/store/slices/files';

import styles from './Breadcrumbs.module.less';
// Maximum length of each individual breadcrumb part
export const BREADCRUMB_MAX_LABEL_LENGTH = 50;

export interface BreadcrumbsProps {
  /** Callback when one of the breadcrumbs is clicked. Called with the folder id */
  onClick: (id: string) => void;
  /** Boolean flag to determine if clicking a breadcrumb should reroute or not */
  isPreview?: boolean;
  /** Id of the preview folder used when moving an item */
  previewFolderId?: string;
  /** custom className */
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  onClick,
  isPreview,
  previewFolderId,
  className,
}) => {
  const { t } = useAppTranslation();
  const breadcrumbs = useAppSelector(selectActiveFileItemBreadcrumbs);
  const previewBreadcrumbs = useAppSelectorExtra(
    selectFileItemBreadcrumbsById,
    previewFolderId || ''
  );

  const crumbs = isPreview ? previewBreadcrumbs : breadcrumbs;

  return (
    <div className={clsx(styles.breadcrumbs, className)}>
      {crumbs.length > 0 ? (
        crumbs.map((item, index) => {
          let partName = index === 0 ? t('FileManagement.Breadcrumb.Root') : item.name;
          if (item.uuid === 'saveditems') {
            // Set breadcrumb name to translated "Saved from messages" to match how we name the legacy folder file management item
            partName = t('FileManagement.SavedFromMessages');
            /* The case where we have no folder breadcrumb data, but we need to manually
             * build a "Files" crumb when there are items from from room. Also build "Saved from items" crumb
             * when we enter into the "Saved from message" folder.
             */
            if (index === 0) {
              return (
                <Fragment key="saved=from-messages-only">
                  <Button className={styles.button} onClick={() => onClick('')}>
                    <span>
                      {truncate(t('FileManagement.Breadcrumb.Root'), {
                        length: BREADCRUMB_MAX_LABEL_LENGTH,
                      })}
                    </span>
                  </Button>
                  {<span className={styles.pathDivider}>/</span>}
                  <Button className={styles.button} onClick={() => onClick(item.uuid)}>
                    <span>
                      {truncate(partName, {
                        length: BREADCRUMB_MAX_LABEL_LENGTH,
                      })}
                    </span>
                  </Button>
                </Fragment>
              );
            }
          }
          /* Render the normal series of breadcrumbs when we have all the folder data from the backend. */
          return (
            <Fragment key={`${item.uuid}`}>
              <Button className={styles.button} onClick={() => onClick(item.uuid)}>
                <span>
                  {truncate(partName, {
                    length: BREADCRUMB_MAX_LABEL_LENGTH,
                  })}
                </span>
              </Button>
              {index < crumbs.length - 1 && <span className={styles.pathDivider}>/</span>}
            </Fragment>
          );
        })
      ) : (
        /* The case where there are no folders in a convo, and manually render a Files root crumb */
        <Fragment key="files">
          <Button className={styles.button}>
            <span>
              {truncate(t('FileManagement.Breadcrumb.Root'), {
                length: BREADCRUMB_MAX_LABEL_LENGTH,
              })}
            </span>
          </Button>
        </Fragment>
      )}
    </div>
  );
};
