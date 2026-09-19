import { clsx } from 'clsx';
import { minutesToMilliseconds } from 'date-fns';
import { forwardRef, SyntheticEvent } from 'react';
import { SpinnerIcon } from '@/componentlibrary';
import DelayRender from '@/componentlibrary/DelayRender';
import useLoadingState from '@/hooks/useLoadingState';

import styles from './SafeImage.module.less';

export type SafeImageLoadingStrategy = 'eager' | 'lazy' | 'delay';

type SafeImageProps = React.HTMLProps<HTMLImageElement> & {
  /** img is in a wrapper */
  wrapperClassName?: string;
  /** Component to render when image fails to load */
  errorEl?: JSX.Element;
  /** Component to render while image is loading */
  loadingEl?: JSX.Element;
  /**
   * Component to render while image is loading and loadingEl is undefined,
   * and rendered when image fails to load if errorEl is undefined.
   */
  fallbackEl?: JSX.Element;
  /** Minimum width applied to the image element (not applied to loading/error/fallback */
  minWidth?: number | string;
  /** Minimum height applied to the image element (not applied to loading/error/fallback */
  minHeight?: number | string;
  /** Maximum width applied to the image element (not applied to loading/error/fallback */
  maxWidth?: number | string;
  /** Maximum height applied to the image element (not applied to loading/error/fallback */
  maxHeight?: number | string;
  /** img loading state to use, defaults to "eager", react doesn't have the type definition for it in HTMLImageElement so we need to define it manually here
   * eager: load the image immediately
   * lazy: load the image when it is in view
   * delay: load the image when it is in view and after a 16ms delay
   */
  loading?: SafeImageLoadingStrategy;
  /** Apply square container styling with object-fit: cover for avatars */
  square?: boolean;
};

// If we have successfully loaded an image, we don't want to bother with rendering the fallback first
// The timeout here is arbitrary, but the main goal is not to display the fallback when re-rendering
// happens often (switching rooms, loading new messages, etc.)
const IMG_TTL = minutesToMilliseconds(30);

/** Track URL and the date it was last loaded */
const previouslyLoadedUrls = new Map<string, number>();

function trackUrlSuccess(url: string | undefined) {
  if (!url) return;
  previouslyLoadedUrls.set(url, Date.now());
}

function wasUrlRecentlyLoaded(url: string | undefined) {
  if (url) {
    const whenLoaded = previouslyLoadedUrls.get(url) ?? 0;
    if (Date.now() - whenLoaded < IMG_TTL) {
      return true;
    }
  }
  return false;
}

const SafeImage = forwardRef<HTMLImageElement, SafeImageProps>(
  (
    {
      wrapperClassName,
      errorEl,
      loadingEl,
      fallbackEl,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      width,
      height,
      loading,
      square,
      ...imgProps
    },
    ref
  ) => {
    const [isLoading, hasError, setLoadingState] = useLoadingState(() =>
      wasUrlRecentlyLoaded(imgProps.src) ? 'loaded' : 'loading'
    );

    // If fallbackEl is defined, it can be used in place of either/both of errorEl and loadingEl
    errorEl ??= fallbackEl;
    loadingEl ??= fallbackEl;

    const handleLoad = (e: SyntheticEvent<HTMLImageElement, Event>) => {
      trackUrlSuccess(imgProps.src);
      setLoadingState('loaded');
      imgProps.onLoad?.(e);
    };

    const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
      setLoadingState('error');
      imgProps.onError?.(e);
    };

    // Always render the <img> because:
    // 1. The <img> needs to be there to load
    // 2. The <img> needs to take up the proper width/height
    // 3. This component is a forwardRef, and we want consumers
    //    to be able to ref the <img> at all times
    // When loading or error, the image is hidden from view

    return (
      <div
        className={clsx(
          styles.safeImage,
          {
            [styles.hideImage]: isLoading || hasError,
            [styles.square]: square,
          },
          wrapperClassName
        )}
        style={{
          minWidth,
          minHeight,
          maxWidth,
          maxHeight,
        }}
      >
        {isLoading && loadingEl}
        {hasError && errorEl}
        {loading === 'delay' ? (
          <DelayRender mode="timeout" delay={16}>
            <img {...imgProps} loading="lazy" onError={handleError} onLoad={handleLoad} ref={ref} />
          </DelayRender>
        ) : (
          <img
            {...imgProps}
            loading={loading}
            onError={handleError}
            onLoad={handleLoad}
            ref={ref}
          />
        )}
      </div>
    );
  }
);

if (__DEV__) SafeImage.displayName = 'SafeImage';

export default SafeImage;

type SafeImageWithLoadingSpinnerProps = Omit<SafeImageProps, 'loadingEl' | 'fallbackEl'> & {
  spinnerSize: number;
};

/** SafeImage that shows a spinner while the image is loading */
export const SafeImageWithLoadingSpinner = forwardRef<
  HTMLImageElement,
  SafeImageWithLoadingSpinnerProps
>(
  (
    { spinnerSize, width, height, minWidth, minHeight, maxWidth, maxHeight, square, ...props },
    ref
  ) => (
    <SafeImage
      {...props}
      square={square}
      loadingEl={
        <div
          className={styles.spinner}
          style={{
            width,
            height,
            maxWidth,
            maxHeight,
            minWidth,
            minHeight,
          }}
        >
          <SpinnerIcon size={`${spinnerSize}`} />
        </div>
      }
      ref={ref}
    />
  )
);

if (__DEV__) SafeImageWithLoadingSpinner.displayName = 'SafeImageWithLoadingSpinner';
