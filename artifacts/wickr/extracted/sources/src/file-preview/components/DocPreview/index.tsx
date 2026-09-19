import { defaultOptions, renderAsync } from 'docx-preview';
import { useEffect, useRef, useState } from 'react';
import { FileLoading } from '../FileLoading';
import PreviewHeader from '../PreviewHeader';
import { Logger } from '@/lib/logger';
import { isAndroid } from '@/utils/platform';

import styles from './styles.module.less';

const logger = new Logger('DocPreview');

interface DocPreviewProps {
  url: string;
}

const DocPreview: React.FC<DocPreviewProps> = ({ url }) => {
  const docRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pages, setPages] = useState<Element[]>([]);

  useEffect(() => {
    if (!docRef.current) return;

    const options = {
      root: docRef.current.parentElement,
      threshold: 0.2,
      rootMargin: '0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageNumber = parseInt(entry.target.getAttribute('data-page-number') || '1', 10);
          setCurrentPage(pageNumber);
        }
      });
    }, options);

    const renderDocument = async () => {
      if (!docRef.current) return;

      try {
        setIsLoading(true);
        const response = await fetch(url);
        if (!response.ok) {
          logger.error('Failed to fetch document:', url);
          return;
        }

        const buffer = await response.arrayBuffer();
        await renderAsync(buffer, docRef.current, docRef.current, {
          ...defaultOptions,
          debug: true,
          experimental: true,
        });

        const wrapper = docRef.current.querySelectorAll('.docx-wrapper');
        wrapper
          ?.values()
          .forEach((w) => w.setAttribute('style', 'background-color: var(--surface-bright);'));
        const sections = docRef.current.querySelectorAll('.docx-wrapper>section');
        const pages: Element[] = [...sections.values()];
        setPages(pages);
        setNumPages(pages.length);

        for (let i = 0; i < pages.length; i++) {
          pages[i].setAttribute('data-page-number', (i + 1).toString());
          observer.observe(pages[i]);
        }
      } catch (err) {
        logger.error('Error rendering document:', err);
      } finally {
        setIsLoading(false);
      }
    };

    renderDocument();

    return () => {
      observer.disconnect();
    };
  }, [url]);

  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= numPages) {
      const currentCanvas = pages[pageNum - 1];
      if (currentCanvas) {
        currentCanvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentPage(pageNum);
      }
    }
  };

  const nextPage = () => {
    goToPage(currentPage + 1);
  };

  const prevPage = () => {
    goToPage(currentPage - 1);
  };

  return (
    <>
      {!isAndroid() && (
        <PreviewHeader
          currentPage={currentPage}
          numPages={numPages}
          prevPage={prevPage}
          nextPage={nextPage}
          goToPage={goToPage}
        />
      )}

      <div className={styles.wrapper}>
        <div className={styles.fileContainer}>
          <div ref={docRef} />
        </div>
        {isLoading && <FileLoading />}
      </div>
    </>
  );
};

export default DocPreview;
