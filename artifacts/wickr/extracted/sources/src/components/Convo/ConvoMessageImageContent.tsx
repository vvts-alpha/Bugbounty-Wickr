import { clsx } from 'clsx';
import React, { forwardRef } from 'react';
import { SafeImageWithLoadingSpinner } from '../SafeImage';
import { wickrWebEndpoints } from '@/apis/webFetch/endpoints';
import { Button } from '@/componentlibrary';
import useForwardedRef from '@/hooks/useForwardedRef';
import { WickrMessage, getMessageFilename } from '@/lib/protobuf/messages';
import { useAppDispatch } from '@/store';
import { pushModal } from '@/store/slices/modal';
import { clampRect } from '@/utils/math';

import styles from './ConvoMessageImageContent.module.less';

// This needs to match the size in ConvoMessageImageContent.module.less
const MAX_IMG_PREVIEW_SIZE = { width: 352, height: 60 };

const MAX_IMG_SIZE_INTERACTIVE = { width: 360, height: 360 };
const MIN_CONTAINER_SIZE_INTERACTIVE = { width: 325, height: 50 };

interface ConvoMessageImageContentProps {
  message: WickrMessage;
  isInteractive?: boolean;
  isPreview?: boolean;
}

const ConvoMessageImageContent = forwardRef<HTMLImageElement, ConvoMessageImageContentProps>(
  ({ message, isInteractive, isPreview }, ref) => {
    const dispatch = useAppDispatch();
    const imgSrc = wickrWebEndpoints.messageImage(message.vGroupID, message.msgId);
    const imgRef = useForwardedRef(ref);

    const filename = getMessageFilename(message);
    const { width, height } = message.file?.imageMetadata ?? {};

    const maxImgSize =
      isPreview && !isInteractive ? MAX_IMG_PREVIEW_SIZE : MAX_IMG_SIZE_INTERACTIVE;

    const minContainerHeight = isPreview
      ? MAX_IMG_PREVIEW_SIZE.height
      : MIN_CONTAINER_SIZE_INTERACTIVE.height;

    const handleClickImage = () => {
      dispatch(pushModal({ name: 'ViewImageModal', params: { message } }));
    };

    // size the image container based on the max image dimensions
    const clamped = clampRect(
      { width: width || 0, height: height ?? minContainerHeight },
      { ...maxImgSize }
    );

    // clamped values are floored, but browser attempts to render subpixels, so round up to avoid subpixels
    const minHeight = Math.ceil(clamped.height);
    const ImageWrapper: any = isInteractive ? Button : 'div';
    const imgContainerStyle = { minHeight: `${minHeight}px` };

    return (
      <div
        className={clsx(styles.messageImageContainer, {
          [styles.interactive]: isInteractive,
          [styles.preview]: isPreview,
        })}
        style={imgContainerStyle}
      >
        <ImageWrapper
          aria-label={filename}
          onClick={isInteractive ? handleClickImage : undefined}
          className={styles.imageWrapper}
        >
          {/* TODO: this is needed because of a bug in rotated images in Android and Desktop
              change this to SafeImage when the bug is fixed: https://sim.amazon.com/issues/Wickr-752 */}
          <SafeImageWithLoadingSpinner
            loading={'lazy'}
            spinnerSize={24}
            src={imgSrc}
            alt={filename}
            // use clamped width and height so that the spinner size will match the actual image size after rendered
            width={clamped.width ?? undefined}
            height={clamped.height ?? undefined}
            minHeight={minHeight}
            maxWidth={maxImgSize.width}
            maxHeight={maxImgSize.height}
            ref={imgRef}
            draggable={false}
          />
        </ImageWrapper>
      </div>
    );
  }
);

const MemoComponent = React.memo(ConvoMessageImageContent);
if (__DEV__) MemoComponent.displayName = 'ConvoMessageImageContent';

export default MemoComponent;
