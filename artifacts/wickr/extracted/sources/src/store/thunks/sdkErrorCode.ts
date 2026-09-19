import { enqueueSdkError } from '../slices/modal/modalSlice';
import { createAppAsyncThunk } from '../utils';
import { AppTranslationKey } from '@/lib/i18n';
import {
  SDK_ERROR_CODE_MAP,
  SdkErrorInfo,
  supportedSdkErrors,
  isCannotAddUserError,
} from '@/utils/sdkErrors';
import { openModal } from './modals';

// Thunk to handle showing error modal
export const pushSdkErrorModal = createAppAsyncThunk(
  `errors/pushSdkErrorModal`,
  async (errorInfo: SdkErrorInfo, { extra, dispatch }) => {
    const { t } = extra;
    const { errorCode } = errorInfo;

    // Handle SSO account termination with a dedicated modal
    if (errorCode === 'SSO_ACCOUNT_TERMINATE') {
      dispatch(openModal({ name: 'CloseAccountModal' }));
      return;
    }

    // Handle cannotAddUsersErrorCodes separately since they're not in SDK_ERROR_CODE_MAP
    if (isCannotAddUserError(errorCode)) {
      // These errors are handled by CannotAddUsersModal, just enqueue the raw error
      dispatch(enqueueSdkError(errorInfo));
      return;
    }

    // Handle regular SDK errors from SDK_ERROR_CODE_MAP
    const errorConfig = SDK_ERROR_CODE_MAP[errorCode as keyof typeof SDK_ERROR_CODE_MAP];
    if (!errorConfig) {
      console.warn(`Unknown SDK error code: ${errorCode}`);
      return;
    }

    const { title, body } = errorConfig;
    const formattedBody =
      typeof body === 'function' ? body(errorInfo, t) : t(body as AppTranslationKey);
    dispatch(
      enqueueSdkError({
        ...errorInfo,
        formattedTitle: t(title),
        formattedBody,
      })
    );
  }
);

export const setSupportedSdkErrors = createAppAsyncThunk(
  `errors/setSupportedSdkErrors`,
  async (_, { extra }) => {
    await extra.bridge.setSupportedSdkErrors({ supportedErrors: supportedSdkErrors });
  }
);
