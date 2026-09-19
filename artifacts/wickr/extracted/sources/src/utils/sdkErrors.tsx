import { AppTranslationKey, AppTranslation } from '@/lib/i18n';

export const cannotAddUsersErrorCodes = [
  'SECURE_ROOM_CREATION_MULTIPLE_USER_VALIDATION_FAILED',
  'GROUP_EDIT_USER_VERIFICATION_FAILED',
  'SECURE_ROOM_CREATION_USER_VERIFICATION_FAILED',
  'SECURE_ROOM_EDIT_MULTIPLE_USER_VALIDATION_FAILED',
  'SECURE_ROOM_EDIT_USER_VERIFICATION_FAILED',
] as const;

export type CannotAddUserError = (typeof cannotAddUsersErrorCodes)[number];

// Define the structure of the error messages with translation keys
export const SDK_ERROR_CODE_MAP = {
  // Message
  MESSAGE_RECALL_FAILED: {
    title: 'Message Recall failed.',
    body: 'Invalid control message.',
  },
  MESSAGE_DELETE_FAILED: {
    title: 'Message Delete failed.',
    body: 'Invalid control message.',
  },
  DELETE_CONVO_NOT_AUTHORIZED_ROOM_MODERATOR_REQUIRED: {
    title: 'Notice',
    body: (errorInfo, t) => {
      return [
        t('Failed to delete {{type}}.', errorInfo),
        t('You are not a room moderator of this secure room.'),
      ].join('\n');
    },
  },
  DELETE_CONVO_FAILED_INVALID_CONTROL_MESSAGE: {
    title: 'Notice',
    body: (errorInfo, t) => {
      return [t('Failed to delete {{type}}.', errorInfo), t('Invalid control message.')].join('\n');
    },
  },
  DELETE_CONVO_FAILED_WITH_ERROR_DETAILS: {
    title: 'Notice',
    body: (errorInfo, t) => {
      return [
        t('Failed to delete {{type}}.', errorInfo),
        errorInfo.message && t(errorInfo.message),
      ].join('\n');
    },
  },
  MESSAGE_RECALL_FAILED_WITH_ERROR_DETAILS: {
    title: 'Notice',
    body: (errorInfo, t) => {
      return [t('Message Recall failed.'), errorInfo.message && t(errorInfo.message)].join('\n');
    },
  },
  MESSAGE_DELETE_FAILED_WITH_ERROR_DETAILS: {
    title: 'Notice',
    body: (errorInfo, t) => {
      return [t('Message Delete failed.'), errorInfo.message && t(errorInfo.message)].join('\n');
    },
  },
  MESSAGE_ATTRIBUTE_CHANGE_FAILED: {
    title: 'Message Attributes change failed',
    body: 'Invalid control message.',
  },
  MESSAGE_ATTRIBUTE_CHANGE_FAILED_WITH_ERROR_DETAILS: {
    title: 'Message Attributes change failed',
    body: (errorInfo, t) => (errorInfo.message ? t(errorInfo.message) : ''),
  },
  MODIFY_PROPERTY_FAILED_NO_SECURE_ROOM: {
    title: 'Modify Property failed',
    body: 'No secure room found with vGroupID: {{vGroupID}}',
  },
  MODIFY_PROPERTY_FAILED_WITH_ERROR_DETAILS: {
    title: 'Modify Property failed',
    body: (errorInfo, t) => (errorInfo.message ? t(errorInfo.message) : ''),
  },
  FILE_SEND_FAILED_INVALID_MESSAGE: {
    title: 'Failed to send file',
    body: 'File message is invalid.',
  },
  SEND_FILE_FAILED_WITH_ERROR_DETAILS: {
    title: 'Failed to send file',
    body: (errorInfo, t) => (errorInfo.message ? t(errorInfo.message) : ''),
  },
  // Convo: Direct Message
  DM_CREATE_UNABLE_TO_FIND_USER_IN_DB: {
    title: 'Unable to create direct message',
    body: (errorInfo, t) => t('Error finding user record for {{user}}.', errorInfo),
  },
  DM_CREATE_GENERIC_VALIDATION_ERROR: {
    title: 'Unable to create direct message',
    body: (errorInfo, t) => t('Error verifying {{user}}.', errorInfo),
  },
  USER_NOT_MIGRATED: {
    title: 'Unable to create direct message',
    body: (errorInfo, t) =>
      t('{{user}} needs to upgrade their Wickr app for you to communicate with them.', errorInfo),
  },
  NETWORK_FEDERATED_NOT_PERMITTED: {
    title: 'Unable to create direct message',
    body: `You don't have permission to communicate with the external member or the account doesn't exist. Contact your Wickr administrator for more information.`,
  },
  DM_CREATE_GENERIC_ERROR: {
    title: 'Unable to create direct message',
    body: (errorInfo, t) => t('Unable to create DM with {{user}}.', errorInfo),
  },
  //Convo
  FAILED_TO_CREATE_CONVO: {
    title: 'Notice',
    body: (errorInfo, t) => {
      const { convoType, apiStatus, ApiCode, errStatus, statusCode, alternativeDetail } = errorInfo;

      return [
        t('Failed to create {{convoType}}.', { convoType }),
        t(apiStatus),
        ApiCode && t('Api Code: {{ApiCode}}', { ApiCode }),
        t(errStatus),
        statusCode && t('Status Code: {{statusCode}}', { statusCode }),
        alternativeDetail && t(alternativeDetail),
      ].join('\n');
    },
  },
  FAILED_TO_DELETE_CONVO: {
    title: 'Notice',
    body: (errorInfo, t) => {
      const { convoType, apiStatus, ApiCode, errStatus, statusCode, alternativeDetail } = errorInfo;

      return [
        t('Failed to delete {{convoType}}.', { convoType }),
        t(apiStatus),
        ApiCode && t('Api Code: {{ApiCode}}', { ApiCode }),
        t(errStatus),
        statusCode && t('Status Code: {{statusCode}}', { statusCode }),
        alternativeDetail && t(alternativeDetail),
      ].join('\n');
    },
  },
  FAILED_TO_LEAVE_CONVO: {
    title: 'Notice',
    body: (errorInfo, t) => {
      const {
        convoType,
        apiStatus,
        ApiCode,
        errStatus,
        statusCode,
        alternativeDetail,
        tdfSelfUserUnauthorized,
        tdfOtherUsersUnauthorized,
      } = errorInfo;

      if (tdfSelfUserUnauthorized)
        return t(
          'You do not have the correct entitlements to make this change to the conversation.'
        );
      if (tdfOtherUsersUnauthorized)
        return t(
          'Members of this conversation do not have the correct entitlements required to make this change.'
        );

      return [
        t('Failed to leave {{convoType}}.', { convoType }),
        t(apiStatus),
        ApiCode && t('Api Code: {{ApiCode}}', { ApiCode }),
        t(errStatus),
        statusCode && t('Status Code: {{statusCode}}', { statusCode }),
        alternativeDetail && t(alternativeDetail),
      ].join('\n');
    },
  },
  FAILED_TO_EDIT_MEMBERS: {
    title: 'Notice',
    body: (errorInfo, t) => {
      const {
        convoType,
        apiStatus,
        ApiCode,
        errStatus,
        statusCode,
        alternativeDetail,
        tdfSelfUserUnauthorized,
        tdfOtherUsersUnauthorized,
      } = errorInfo;

      if (tdfSelfUserUnauthorized)
        return t(
          'You do not have the correct entitlements to make this change to the conversation.'
        );
      if (tdfOtherUsersUnauthorized)
        return t(
          'Members of this conversation do not have the correct entitlements required to make this change.'
        );

      return [
        t('Failed to edit members for {{convoType}}.', { convoType }),
        t(apiStatus),
        ApiCode && t('Api Code: {{ApiCode}}', { ApiCode }),
        t(errStatus),
        statusCode && t('Status Code: {{statusCode}}', { statusCode }),
        alternativeDetail && t(alternativeDetail),
      ].join('\n');
    },
  },
  FAILED_TO_EDIT_SETTINGS: {
    title: 'Notice',
    body: (errorInfo, t) => {
      const {
        convoType,
        apiStatus,
        ApiCode,
        errStatus,
        statusCode,
        alternativeDetail,
        tdfSelfUserUnauthorized,
        tdfOtherUsersUnauthorized,
      } = errorInfo;
      if (tdfSelfUserUnauthorized)
        return t(
          'You do not have the correct entitlements to make this change to the conversation.'
        );
      if (tdfOtherUsersUnauthorized)
        return t(
          'Members of this conversation do not have the correct entitlements required to make this change.'
        );
      return [
        t('Failed to edit {{convoType}} setting.', { convoType }),
        t(apiStatus),
        ApiCode && t('Api Code: {{ApiCode}}', { ApiCode }),
        t(errStatus),
        statusCode && t('Status Code: {{statusCode}}', { statusCode }),
        alternativeDetail && t(alternativeDetail),
      ].join('\n');
    },
  },
  // Room
  ERROR_CREATING_ROOM: {
    title: 'Notice',
    body: 'No response from server.',
  },
  REMOVED_FROM_ACTIVE_ROOM: {
    title: 'Notice',
    body: 'You have been removed from this room.',
  },
  ACTIVE_ROOM_DELETED: {
    title: 'Notice',
    body: 'This room has been deleted.',
  },
  // Room TDF
  NON_TDF_FILE_ATTEMPT: {
    title: 'File type cannot be sent',
    body: 'This chat only supports trusted data formats.',
  },
  INVALID_TDF_FILE_NO_MANIFEST: {
    title: 'File type cannot be sent',
    body: 'This chat only supports valid trusted data formats.',
  },
  INVALID_TDF_FILE_NO_TAGS: {
    title: 'File cannot be sent',
    body: 'This chat only supports trusted data formats with proper tagging.',
  },
  TDF_CANNOT_PIN_FILE: {
    title: 'File cannot be saved',
    body: (errorInfo, t) => {
      if (errorInfo.tdfSelfUserUnauthorized === true)
        return t(
          'You do not have the correct entitlements to save this file to this conversation.'
        );
      if (errorInfo.tdfSelfUserUnauthorized === false)
        return t(
          'Members of this conversation do not have the correct entitlements for this file to be saved.'
        );
      return t('Unable to determine entitlements, try again later.');
    },
  },
  TDF_CANNOT_DOWNLOAD_FILE: {
    title: 'File cannot be downloaded',
    body: (errorInfo, t) => {
      if (errorInfo.tdfSelfUserUnauthorized)
        return t('You do not have the correct entitlements to download this file.');
      return t('Unable to determine entitlements, try again later.');
    },
  },
  TDF_CANNOT_OPEN_FILE: {
    title: 'File cannot be opened',
    body: (errorInfo, t) => {
      if (errorInfo.tdfSelfUserUnauthorized)
        return t('You do not have the correct entitlements to open this file.');
      return t('Unable to determine entitlements, try again later.');
    },
  },
  TDF_FILE_PROGRAM_TAGS_INCORRECT: {
    title: 'File tags incorrect',
    body: (errorInfo, t) => {
      if (errorInfo.tdfSelfUserUnauthorized === true)
        return t(
          'You do not have the correct entitlements to send this file to this conversation.'
        );
      else if (errorInfo.tdfSelfUserUnauthorized === false)
        return t(
          'Members of this conversation do not have the correct entitlements to receive this file.'
        );
      return t('Unable to determine entitlements, try again later.');
    },
  },
  SECURE_ROOM_CREATION_SELF_USER_FAILED_TDF_CHECK: {
    title: 'Failed to create room',
    body: 'You do not have the correct entitlements to create this room.',
  },
  SECURE_ROOM_GET_TDF_TAGS_FAILED: {
    title: 'Notice',
    body: 'Unable to successfully get tags from TDF provider.',
  },
  FAILED_TO_START_CALL_TDF: {
    title: 'Notice',
    body: (errorInfo, t) => {
      if (errorInfo.tdfSelfUserUnauthorized)
        return t('You do not have the correct entitlements to start a call in this conversation.');
      if (errorInfo.tdfOtherUsersUnauthorized)
        return t(
          'Members of this conversation do not have the correct entitlements to start a call.'
        );
      return t('Unable to determine entitlements, try again later.');
    },
  },
  TDF_SELF_USER_NOT_AUTHORIZED_DESCRIPTION_CHANGE: {
    title: 'Notice',
    body: 'You do not have the correct entitlements to make this description change.',
  },
  // Group
  GROUP_CONVO_CREATION_PREP_FAILED: {
    title: 'Notice',
    body: 'Error creating conversation.',
  },
  GROUP_CONVO_PREP_USER_RECORD_NOT_FOUND: {
    title: 'Notice',
    body: (errorInfo, t) => t('Error finding user record for {{userName}}.', errorInfo),
  },
  GROUP_CREATION_FAILED_WITH_ERROR_DETAILS: {
    title: 'Unable to create group',
    body: (errorInfo, t) => (errorInfo.message ? t(errorInfo.message) : ''),
  },
  GROUP_CREATION_USER_VERIFICATION_ERROR: {
    title: 'Unable to create group',
    body: 'Error verifying users.',
  },
  GROUP_CONVO_PREP_COMPLETE_ROOM_CREATION_FAILED: {
    title: 'Notice',
    body: 'Failed to create room',
  },
  // Device sync
  DEVICE_AUTHORIZATION_FAILURE: {
    title: 'Device Synchronization Error',
    body: (errorInfo, t) => t('Device Authorization Failure, Error - {{authStatus}}', errorInfo),
  },
  DEVICE_AUTHORIZATION_CREATION_FAILURE_PRIMARY: {
    title: 'Device Synchronization Error (Manual Code Entry)',
    body: (errorInfo, t) =>
      t('Device Authorization Creation Failure (PRIMARY), Error - {{authStatus}}', errorInfo),
  },
  COULD_NOT_RETRIEVE_IDENTITY_CODE: {
    title: 'Device Synchronization Error (Manual Code Entry)',
    body: 'Device Authorization Identity Failure, Error - Could not retrieve identity.',
  },
  DEVICE_AUTHORIZATION_CREATION_FAILURE_ALTERNATE: {
    title: 'Device Synchronization Error (Manual Code Entry)',
    body: (errorInfo, t) =>
      t('Device Authorization Creation Failure (ALTERNATE), Error - {{authStatus}}', errorInfo),
  },
  DEVICE_AUTHORIZATION_FINGERPRINT_FAILURE: {
    title: 'Device Synchronization Error (Manual Code Entry)',
    body: (errorInfo, t) =>
      t(
        'Device Authorization Fingerprint Failure. Please try again. Error - {{fingerPrintStatus}}',
        errorInfo
      ),
  },
  DEVICE_AUTHORIZATION_VERIFY_FAILURE: {
    title: 'Device Synchronization Error (Manual Code Entry)',
    body: (errorInfo, t) =>
      t(
        'Device Authorization Verify Failure. Please try again. Error - {{responseError}}',
        errorInfo
      ),
  },
  INVALID_DEVICE_AUTH_CONTENT: {
    title: 'Device Synchronization Error',
    body: 'Device Authorization Failure, Error - invalid device auth context.',
  },
  DEVICE_DATABASE_BACKUP_FAILURE: {
    title: 'Device Synchronization Error',
    body: (errorInfo, t) =>
      t('Device Database Backup Failure, Error - {{responseError}}', errorInfo),
  },
  FAILED_TO_SERIALIZE_DEVICE_DATA: {
    title: 'Device Synchronization Error',
    body: 'Device Backup Failure, Error - Failed to Serialize device data.',
  },
  DEVICE_PUSH_FAILURE: {
    title: 'Device Synchronization Error',
    body: (errorInfo, t) => t('Device Backup Failure, Error - {{responseError}}', errorInfo),
  },
  FAILED_TO_SERIALIZE_DEVICE_KEYS: {
    title: 'Device Synchronization Error',
    body: 'Device Backup Failure, Error - Failed to Serialize device keys.',
  },
  COULD_NOT_RETRIEVE_IDENTITY_QR: {
    title: 'Device Synchronization Error (QR Code & Scan)',
    body: 'Device Authorization Failure, Error - could not retrieve identity.',
  },
  FILE_ALREADY_SAVED: {
    title: 'Already saved',
    body: 'This file has already been saved in the Files tab.',
  },
  MODIFY_NOTIFICATION_INFO_FAILED_WITH_ERROR_DETAILS: {
    title: 'Unable to update notification settings',
    body: 'Try again',
  },
  WOA_PROXY_NOT_STARTED: {
    title: 'Wickr Open Access Status',
    body: (errorInfo, _t) => errorInfo.message,
  },
  WOA_FOA_ON: {
    title: 'Wickr Open Access Status',
    body: 'Your Administrator has required Wickr Open Access (WOA) for your network, we need to start WOA now.',
  },
  WOA_DISABLED_ON_NETWORK: {
    title: 'Wickr Open Access Status',
    body: 'Your Administrator has disabled WOA on your network, we need to stop WOA now.',
  },
  WOA_ADMIN_UPDATED_CONFIG: {
    title: 'Wickr Open Access Status',
    body: 'Your Administrator has updated your WOA configuration, we need to restart WOA now.',
  },
  WOA_PROBLEM_WITH_CONFIG: {
    title: 'Wickr Open Access Status',
    body: (errorInfo, t) => {
      return [
        t(
          "There is a problem with your network's Wickr Open Access configuration. Please contact your administrator. Your device will continue to work on your normal network connection."
        ),
        t('WOA Error: {{statusMsg}}', { errorInfo }),
      ].join('\n');
    },
  },
  WOA_FALLBACK_TO_OLD_CONFIG: {
    title: 'Wickr Open Access Status',
    body: 'Invalid Wickr Open Access (WOA) config received. Falling back to an old configuration file, but this might cause issues connecting to WOA. Contact your network admin for help.',
  },
  WOA_FOA_CANNOT_LOGIN_INVALID_CONFIG: {
    title: 'Wickr Open Access Status',
    body: 'Invalid Wickr Open Access (WOA) config received. Unable to login due to FOA (forced open access) settings. Please contact your network admin for help.',
  },
  LINK_ALREADY_SAVED: {
    title: 'Notice',
    body: 'This link already has been saved.',
  },
  DIRECTORY_SERVER_ERROR: {
    title: 'Directory Server Error',
    body: 'Directory unavailable due to a server error. Please try again in a few minutes.',
  },
  SSO_ACCOUNT_TERMINATE: {
    title: 'Are you sure you want to close your account',
    body: 'This is a permanent action. It will delete your Wickr account and reset the application.',
  },
  // Add more error codes as needed
} satisfies {
  [key: string]: {
    title: AppTranslationKey;
    body: AppTranslationKey | ((errorInfo: any, t: AppTranslation) => string);
  };
};

export type SdkErrorCode = keyof typeof SDK_ERROR_CODE_MAP | CannotAddUserError;

export const supportedSdkErrors = [
  ...Object.keys(SDK_ERROR_CODE_MAP),
  ...cannotAddUsersErrorCodes,
] as SdkErrorCode[];

// Type guard function to check if an error code is a CannotAddUserError
export const isCannotAddUserError = (errorCode: string): errorCode is CannotAddUserError => {
  return cannotAddUsersErrorCodes.includes(errorCode as CannotAddUserError);
};

export type SupportedSdkErrorsPayload = {
  supportedErrors: SdkErrorCode[];
};

export type SdkErrorInfo = {
  errorCode: SdkErrorCode;
  [key: string]: any;
};

export const insertLinebreaks = (content: string): (string | JSX.Element)[] => {
  const arr = content.split('\n');
  const result: (string | JSX.Element)[] = [];
  arr.forEach((line, index) => {
    result.push(line);
    if (index < arr.length - 1) {
      result.push(<br key={index} />);
    }
  });
  return result;
};
