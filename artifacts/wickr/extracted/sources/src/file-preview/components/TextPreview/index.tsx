import { useState } from 'react';
import { VirtualList } from '@/componentlibrary/VirtualList/VirtualList';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import { splitLines } from '@/utils/strings';

import styles from './styles.module.less';

const TextPreview: ReactFC<{ url: string; transformText?: (text: string) => string }> = ({
  url,
  transformText,
}) => {
  // split text into lines to make rendering large files a little better
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  useAsyncEffect(
    async ({ signal }) => {
      setLines([]);
      setError(undefined);
      const res = await fetch(url, { signal });
      try {
        const text = await res.text();
        const transformed = transformText?.(text) ?? text;
        setLines(splitLines(transformed));
        setError(undefined);
      } catch (err) {
        setLines([]);
        setError(`${err}` || 'Error loading file');
      }
    },
    [url]
  );

  return (
    <div className={styles.container}>
      <div className={styles.text}>
        {error ? (
          error
        ) : (
          <VirtualList
            items={lines}
            keySelector={(_line, i) => i.toString()}
            itemHeightType="static"
            innerClassName={styles.vlistInternal}
            renderItem={(line) => {
              // add space so blank lines are no collapsed
              return <p>{line}&nbsp;</p>;
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TextPreview;
