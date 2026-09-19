import { ContactBackup } from '@amzn/wickr-messaging-protocol-proto';
import isTypedArray from 'lodash/isTypedArray';
import prettyFormat, { Config, NewPlugin, Printer, Refs } from 'pretty-format';
import { Logger } from '@/lib/logger';
import { WickrUser } from '@/lib/protobuf/users';
import { isHtmlElement } from './dom';

const logger = new Logger('utils/strings');
export const REDACTED = '-';

export const HUNDRED_AND_MORE_BADGE_TEXT = '99+';

/** Return value in dev and redacted value in prod */
export const redactInProd = <T, R>(value: T, redacted: R | string = REDACTED) =>
  __DEV__ ? value : redacted;

/** Attempts to ID an element based on id, testid, class names and possibly anscestor elements */
export function getElementIdentifier(el: unknown, inspectAnscestorAsNeeded?: boolean): string {
  if (!isHtmlElement(el)) return '';
  let { id } = el;
  if (id) {
    return `${el.tagName}#${id}`;
  } else {
    const { testid } = el.dataset;
    if (testid) {
      id = `${el.tagName}[testid=${testid}]`;
    } else {
      id = `${el.tagName}.${el.className.trim().split(/\s+/).join('.')}`;
    }

    // to get the shortest string possible, we only inspect anscestors if
    // an ID is not found, as that is the most specific and should be unique
    if (inspectAnscestorAsNeeded) {
      const anscestors = getElementIdentifier(el.parentNode);
      if (anscestors) {
        return `${anscestors} > ${id}`;
      }
      return id;
    } else {
      return id;
    }
  }
}

/** Simple HTML serializeer that does not traverse children */
const htmlPlugin = {
  test(value: unknown) {
    return isHtmlElement(value);
  },
  serialize(
    el: HTMLElement,
    _config: Config,
    _indentation: string,
    _depth: number,
    _refs: Refs,
    _printer: Printer
  ): string {
    return getElementIdentifier(el, false);
  },
} satisfies NewPlugin;

/**
 * undefined is not valid JSON, so convert to null
 * Valid JSON is not a goal of prettyFormat, but it is helpful if basic types can be handled
 */
const undefinedToNullPlugin = {
  test(value: unknown) {
    return typeof value === 'undefined';
  },
  serialize() {
    return 'null';
  },
} satisfies NewPlugin;

const errorPlugin = {
  test(value: unknown) {
    return Boolean(value && value instanceof Error);
  },
  serialize(err: Error) {
    return err.stack ?? err.message ?? err.name ?? 'Error';
  },
} satisfies NewPlugin;

export function getObjectDescriptor(obj: any): string {
  if (!obj) {
    return obj === null ? 'null' : typeof obj;
  } else if (typeof obj === 'symbol') {
    return 'Symbol';
  } else if (typeof obj === 'object' && obj.constructor) {
    return obj.constructor.name || 'AnonymousObject';
  }

  return 'UnknownObject';
}

const ObjectConstructors: object[] = [Object, Array, Date, RegExp];

/** Don't dive into the internals of classes and other custom objects */
const objectDescriptorPlugin = {
  test(value: unknown) {
    return Boolean(
      value &&
        typeof value === 'object' &&
        !(value instanceof Error) &&
        !ObjectConstructors.includes(value.constructor)
    );
  },
  serialize(obj: AnyObject) {
    return getObjectDescriptor(obj);
  },
} satisfies NewPlugin;

const typedArrayPlugin = {
  // can't do instanceOf TypedArray directly because it's hidden
  test: isTypedArray,
  serialize(arr: NodeJS.TypedArray) {
    return arr.constructor.name;
  },
} satisfies NewPlugin;

export function prettyFormatLog(log: unknown): string {
  return typeof log === 'string'
    ? log
    : prettyFormat(log, {
        maxDepth: 5,
        min: true,
        plugins: [
          htmlPlugin,
          undefinedToNullPlugin,
          errorPlugin,
          objectDescriptorPlugin,
          typedArrayPlugin,
        ],
      });
}

/**
 * Takes the file size, in bytes, and formats it to a best possible formatted string.
 * Example, 6400 Bytes formats to 6.4 KB
 *
 * @param sizeInBytes
 * @returns string
 */
export const formatFileSize = (sizeInBytes?: number | null): string => {
  if (!sizeInBytes) return '0 bytes';

  if (sizeInBytes > 1e12) {
    // Terabyte
    return `${(sizeInBytes / 1e12).toFixed(1)} TB`;
  } else if (sizeInBytes > 1e9) {
    // Gigabyte
    return `${(sizeInBytes / 1e9).toFixed(1)} GB`;
  } else if (sizeInBytes > 1e6) {
    // Megabyte
    return `${(sizeInBytes / 1e6).toFixed(1)} MB`;
  } else if (sizeInBytes > 1e3) {
    // Kilobyte
    return `${(sizeInBytes / 1e3).toFixed(1)} KB`;
  } else return `${sizeInBytes.toFixed(1)} bytes`;
};

export const capitalize = (word: string): string => {
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
};

export const getInitialsFromName = (name: string) => {
  name = name?.trim();
  if (!name) return '';

  const namePieces = name.split(/\s+/);

  const firstNameInitial = namePieces.shift()?.trim()?.charAt(0)?.toLocaleUpperCase();
  const lastNameInitial = namePieces.pop()?.trim()?.charAt(0)?.toLocaleUpperCase();

  return (firstNameInitial ?? '') + (lastNameInitial ?? '');
};

export const getContactDisplayName = (contact?: ContactBackup.IContact | null) =>
  contact?.customName ?? contact?.name ?? contact?.id ?? '';

export const aliasFromEmail = (email: string) => {
  const alias = email && email.split('@');
  return alias ? alias[0] : email;
};

export const getContactDisplayId = (contact?: ContactBackup.IContact | null) => contact?.id ?? '';

export const blobToBase64 = (blob: Blob): Promise<string> => {
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  return new Promise((resolve) => {
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
  });
};

type CopyClipboardObject = {
  'text/plain': Blob;
  'text/html'?: Blob;
};

export const copyTextToClipboard = async (
  text?: string | null,
  html?: string
): Promise<boolean> => {
  if (!text) {
    logger.warn('copyTextToClipboard:: no text to copy');
    return false;
  }

  // Always set the clipboards text/plain by default so non-html text readers can paste appropriately.
  const clipboardObj: CopyClipboardObject = {
    'text/plain': new Blob([text], { type: 'text/plain' }),
  };

  if (html) clipboardObj['text/html'] = new Blob([html], { type: 'text/html' });

  const data = [new ClipboardItem(clipboardObj)];
  await navigator.clipboard.write(data);
  return true;
};

export const isUndefinedOrEmpty = (
  value: string | number | undefined | null
): value is null | undefined | '' => {
  return value === null || value === undefined || value === '';
};

/*
  Modified from
    cyrb53 (c) 2018 bryc (github.com/bryc)
    License: Public domain (or MIT if needed). Attribution appreciated.
    A fast and simple 53-bit string hash function with decent collision resistance.
    Largely inspired by MurmurHash2/3, but with a focus on speed/simplicity.
*/
export const getHash = function (content: string, length = 6) {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0, ch; i < content.length; i++) {
    ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combinedValue = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combinedValue.toString(16).substring(0, length).padEnd(length, '0');
};

export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isEmptyString(value: any): value is string {
  return isString(value) && !value.length;
}

export function isNonEmptyString(value: any): value is string {
  return isString(value) && !!value.length;
}

export const emailRegex =
  /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i;

export const isValidEmail = (email?: string): email is string => {
  return !!email && emailRegex.test(email);
};

export const multipleEmailsRegex =
  /\b(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})\b/gi;

export function redactEmails(input: string, replacement = '***@***'): string {
  return input.replace(multipleEmailsRegex, replacement);
}

/** Some strings are not translated on purpose. We wrap them with raw() so that it is clear to other developers that we didn't miss them when translating strings */
export function raw(s: string) {
  return s;
}
export const EmojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
export const hasEmoji = (text: string) => {
  return EmojiRegex.test(text);
};

/** Returns the first letter of a contact's name if A-Z, otherwise returns undefined */
export const getContactSectionString = (contact: WickrUser) => {
  const letter = getInitialsFromName(getContactDisplayName(contact))[0];
  return /[A-Z]/.test(letter) ? letter : undefined;
};

/**
 * This function removes white spaces from a given string
 */
export function removeSpaces(str: string): string {
  if (!str) return str;

  return str.replace(/ +/g, '');
}

export function safeStringify(value: any): string {
  // performance benchmark across different libraries: https://tiny.amazon.com/u5bkazq4/jsbeeyJ
  try {
    // JSON.stringify is fast, try it first
    // there are only two cases it will throw errors, and prettyFormat can handle all of them
    // 1. value contains a circular reference.
    // 2. A BigInt value is encountered.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#exceptions
    return JSON.stringify(value);
  } catch {
    // prettyFormat is 9.4x slower, but
    // it handles circular structure and BigInt without error
    // it supports RegExp, Set, Map, Error, and URL
    // it's deterministic, so we can get consistent hash from stringified results
    return prettyFormat(value, { min: true });
  }
}

export const isASCII = (input: string) => /[\p{ASCII}]+/u.test(input);

/**
 * Creates a redaction function that removes part of IDs of a specified length within a content string
 *
 * @param idLength - The exact length of the IDs to match and redact
 * @param keepLength - The number of characters to keep at the beginning of each matched ID
 *
 * @returns A function that takes a content string and returns it with specified IDs redacted
 *
 * **ID Matching Criteria:**
 *   - Matches sequences of exactly `idLength` consecutive characters from the set `a`-`g`, `s`, and digits (`0`-`9`)
 *   - IDs are matched only if preceded and followed by non-matching characters or string boundaries
 *
 * **Redaction Logic:**
 *   - Replaces the matched ID with only the first `keepLength` characters, deleting the rest
 *
 * **Example:**
 *
 * ```typescript
 * const redactGroupId = createRedactIds(64, 10);
 * const content = "Sensitive IDs: abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890 and other text.";
 * const redactedContent = redactGroupId(content);
 * // Output: "Sensitive IDs: abcdef1234 and other text."
 * ```
 */
export function createRedactIds(idLength: number, keepLength: number): (content: string) => string {
  // Define the character set to match: letters 'a' to 'g', 's', and digits '0' to '9'
  const charSet = 'abcdefgs0-9';

  // Compile the regular expression once, using the specified parameters and 'gi' flags
  const regex = new RegExp(
    `(^|[^${charSet}])` + // Capture group 1 (p1): Start of string or a non-matching character
      `([${charSet}]{${idLength}})` + // Capture group 2 (id): Exactly 'idLength' matching characters
      `(?![${charSet}])`, // Negative lookahead: Not followed by a matching character
    'gi'
  );

  // Return the redaction function
  return (content: string): string => {
    return content.replace(regex, (_, p1, id) => {
      // Keep only the first 'keepLength' characters of the ID
      const keptPart = id.substring(0, keepLength);
      // Return the prefix and the kept part of the ID
      return p1 + keptPart;
    });
  };
}

export function redactPII(args: any[]) {
  try {
    return args
      .map((message) => {
        try {
          return prettyFormatLog(message);
        } catch {
          return `${message}`;
        }
      })
      .map((message) => redactEmails(message))
      .map((message) => redact32CharsId(message)) // redact msgIds
      .map((message) => redact64CharsId(message)); // redact vGroupIds, tempMsgIds, userIdHashes, deviceId
  } catch {
    // no-op, empty array so type is not undefined
    return [];
  }
}

export const redact32CharsId = createRedactIds(32, 15);
export const redact64CharsId = createRedactIds(64, 15);

/**
 * Splits a string into lines
 */
export function splitLines(text: string) {
  let normalized = text.split('\r\n').join('\n'); // Normalize Windows CRLF to LF
  normalized = normalized.split('\r').join('\n'); // Normalize old Mac CR to LF
  return normalized.split('\n'); // Split by LF
}

export function processOnboardingDeviceVerifyKey(key: string) {
  // Extract first 6 characters as main key
  const mainKeyRaw = key.slice(0, 6);

  // Format main key with space after first 3 characters
  const mainKey = `${mainKeyRaw.slice(0, 3)} ${mainKeyRaw.slice(3)}`;

  // Get the rest as sub key
  const subKeyRaw = key.slice(6);

  // Add space every 6 characters in sub key
  const subKey = subKeyRaw.match(/.{1,6}/g)?.join(' ') || '';

  return {
    mainKey,
    subKey,
  };
}
