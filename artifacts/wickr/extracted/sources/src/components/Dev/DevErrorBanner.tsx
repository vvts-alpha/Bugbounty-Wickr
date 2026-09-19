import { spyOnMethod } from '@amzn/async-utils';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useEffect, useReducer } from 'react';
import { Button, CautionIcon, Tooltip } from '@/componentlibrary';
import useEventListener from '@/hooks/useEventListener';
import { devErrorTracker } from '@/lib/devErrors';
import { Logger } from '@/lib/logger';
import { useSetting } from '@/store/hooks/useSetting';
import { PrefixedError, isErrorLike, toError } from '@/utils/error';

import styles from './Dev.module.less';

const logger = new Logger('DevErrorBanner');

// Match ID in prebootstrap
const errorBannerId = 'dev_error_banner';

/** Ignore errors that contain these messages */
const ignoreErrorsIncluding = [
  // protobuf warning
  'There is already an encoder',
  // web channel with no matching signal
  'channel.execCallbacks[message.id] is not a function',
  // ResizeObserver uncatchable errors
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
];

// create error object, but ignore ones we know we don't care about
function toErrorWeCareAbout(error: any): Error | undefined {
  const err = toError(error);
  if (err && ignoreErrorsIncluding.some((msg) => err.message.includes(msg))) {
    return;
  }
  return err;
}

function maybeUnwrapErrorEvent(errorEvent: any) {
  if (errorEvent && isErrorLike(errorEvent.error)) {
    return errorEvent.error;
  }
  return errorEvent;
}

type DevError = {
  error: Error;
  timeStamp: number;
};

type DevErrors = {
  errors: DevError[];
};

type AddErrorPayload = {
  error: any;
  label?: string;
};

const initialState: DevErrors = { errors: [] };

const devErrorsSlice = createSlice({
  name: 'devErrors',
  initialState,
  reducers: {
    addError: (state, { payload }: PayloadAction<AddErrorPayload>) => {
      const err = payload.label
        ? new PrefixedError(`${payload.label}: `, maybeUnwrapErrorEvent(payload.error))
        : maybeUnwrapErrorEvent(payload.error);
      // Not all errors that are picked up by error handlers are logged to console, so log as-is just in case
      if (__DEV__ && payload.label !== 'react') logger.error(payload.label ?? '', err);
      const error = toErrorWeCareAbout(err);
      if (error) {
        state.errors.push({ error, timeStamp: Date.now() });
      }
    },
    clearErrors: (state) => {
      state.errors = [];
    },
  },
});

const { addError, clearErrors } = devErrorsSlice.actions;
const devErrorsReducer = devErrorsSlice.reducer;

type DevErrorBannerProps = {
  /**
   * Called when the DevErrorBanner begins capturing errors itself
   * @returns An array of errors that were captured before the banner was mounted
   */
  onHandoffErrorCapturing?: () => any[];
};

export const DevErrorBanner: React.FC<DevErrorBannerProps> = (props) => {
  const isProduction = useSetting('isProduction');

  useEffect(() => {
    // the initial state of isProduction is true, but in non-prod
    // environments it will (quickly) change to false. Main is capturing
    // errors, but we want to stop that when we know we are in prod or
    // if DevErrorBannerInternal starts listening to errors itself.
    if (isProduction) {
      const handleTracker = setTimeout(() => devErrorTracker.setDevErrorHandler((e) => {}), 2000);
      return () => {
        clearTimeout(handleTracker);
      };
    }
  }, [isProduction]);

  return (
    // always need an element with errorBannerId because if prebootstrap.ts
    // doesn't find it, it prints the error in the body
    <div className={styles.devErrorBanner} id={errorBannerId}>
      {!isProduction && <DevErrorBannerInternal />}
    </div>
  );
};

const DevErrorBannerInternal: React.FC<DevErrorBannerProps> = ({ onHandoffErrorCapturing }) => {
  const [{ errors }, dispatch] = useReducer(devErrorsReducer, { errors: [] });

  useEffect(() => {
    devErrorTracker.setDevErrorHandler((error) => {
      dispatch(addError({ error }));
    });
  }, []);

  useEffect(() => {
    // Get notified about React warnings in DEV
    const restoreConsoleError = __DEV__
      ? spyOnMethod(console, 'error', {
          onBefore: () => {},
          onAfter: ({ args }) => {
            const [msg] = args;
            if (typeof msg === 'string' && msg.startsWith('Warning: React')) {
              dispatch(addError({ label: 'react', error: new Error(msg) }));
            }
          },
        })
      : () => {};
    return () => {
      restoreConsoleError();
    };
  }, []);

  useEventListener(window, 'error', (error) => dispatch(addError({ label: 'win.error', error })));
  useEventListener(window, 'unhandledrejection', (event) => {
    dispatch(
      addError({
        label: 'unhandledrejection',
        error: new Error(`Unhandled Rejection: ${event.reason}`),
      })
    );
  });

  if (!errors.length) return null;

  return (
    <>
      <div className={styles.alwaysVisible}>
        <Tooltip tip="Clear errors" className="light-theme">
          <Button label="Clear errors" onClick={() => dispatch(clearErrors())}>
            <CautionIcon />
            <span>{errors.length}</span>
          </Button>
        </Tooltip>
      </div>
      <div className={styles.whenActive}>
        <p>
          <strong>Runtime errors (only visible internally)</strong>
        </p>
        {errors.map(({ error, timeStamp }, idx) => {
          return (
            <details key={idx}>
              <summary>{error.message}</summary>
              <div>{error.stack}</div>
              <div>@ {new Date(timeStamp).toLocaleString()}</div>
            </details>
          );
        })}
      </div>
    </>
  );
};
