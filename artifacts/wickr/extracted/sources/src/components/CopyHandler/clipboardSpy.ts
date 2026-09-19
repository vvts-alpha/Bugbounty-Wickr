import { toError } from '@/utils/error';

type RestoreOriginal = () => void;

type ActionType = 'write' | 'writeText';

type ActionData =
  | {
      error: Error;
      result?: never;
    }
  | {
      error?: never;
      result: any;
    };

type ActionEvent = {
  type: ActionType;
} & ActionData;

function handleResult(result: any): ActionData {
  return { result };
}

function handleError(error: any): ActionData {
  return { error: toError(error) };
}

export function spyOnClipboardWrite(onWrite: (e: ActionEvent) => void): RestoreOriginal {
  const { clipboard } = navigator;
  const { write, writeText } = clipboard;
  clipboard.write = (...args: Parameters<typeof clipboard.write>) => {
    const promise = write.apply(clipboard, args);
    promise.then(handleResult, handleError).then((data) => onWrite({ type: 'write', ...data }));
    return promise;
  };
  clipboard.writeText = (...args: Parameters<typeof clipboard.writeText>) => {
    const promise = writeText.apply(clipboard, args);
    promise.then(handleResult, handleError).then((data) => onWrite({ type: 'writeText', ...data }));
    return promise;
  };

  // Restore originals
  return () => {
    clipboard.write = write;
    clipboard.writeText = writeText;
  };
}
