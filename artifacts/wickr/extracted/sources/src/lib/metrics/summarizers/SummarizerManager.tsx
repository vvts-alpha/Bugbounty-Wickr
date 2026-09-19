import { useEffect, useRef, useState } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import { devErrorTracker } from '@/lib/devErrors';
import { createMemorySummarizer, MemorySummarizer } from './memorySummarizer';
import { createResponsivenessSummarizer } from './responsivenessSummarizer';

export const SummarizerManager = () => {
  const { bridge } = useWebChannel();

  const respSumRef = useRef(createResponsivenessSummarizer());

  const [webMemSum, setWebMemSum] = useState<MemorySummarizer | null>(null);
  useEffect(() => {
    createMemorySummarizer(bridge, 'WEBVIEW').then(
      (value) => {
        setWebMemSum(value);
      },
      (reason) => {
        devErrorTracker.addError(new Error('Webview', { cause: reason }), 'Memory summarizer');
      }
    );
  }, [bridge]);

  const [qtMemSum, setQtMemSum] = useState<MemorySummarizer | null>(null);
  useEffect(() => {
    createMemorySummarizer(bridge, 'QT').then(
      (value) => {
        setQtMemSum(value);
      },
      (reason) => {
        devErrorTracker.addError(new Error('Qt', { cause: reason }), 'Memory summarizer');
      }
    );
  }, [bridge]);

  // cleanup
  useEffect(
    () => () => {
      respSumRef.current.stop();
      if (webMemSum) webMemSum.stop();
      if (qtMemSum) qtMemSum.stop();
    },
    [webMemSum, qtMemSum]
  );

  return null;
};
