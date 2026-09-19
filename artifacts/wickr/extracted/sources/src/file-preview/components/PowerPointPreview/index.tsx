import { clsx } from 'clsx';
import DOMPurify from 'dompurify';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlexCentered, Heading, SpinnerIcon } from '@/componentlibrary';
import { useOnResized } from '@/hooks/resizeObserver';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import useChangeEffect from '@/hooks/useChangeEffect';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';
import pptxWorkerUrl from '@/lib/pptx2html/pptx2html.worker.js?worker&url';
import { toError } from '@/utils/error';
import { fixLocalUrl } from '@/utils/url';

import styles from './styles.module.less';
import '@/lib/pptx2html/pptx2html.css';

const WORKER_URL = fixLocalUrl(pptxWorkerUrl);

const logger = new Logger('PPT');

function sanitizeHtml(dirtyHtml: string) {
  return DOMPurify.sanitize(dirtyHtml, {
    USE_PROFILES: {
      html: true,
      svg: true,
    },
  });
}

const PowerPointPreview: ReactFC<{ url: string }> = ({ url }) => {
  const { t } = useAppTranslation();
  const [cssText, setCssText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const [sanitizedHtml, setSanitizedHtml] = useState('');
  const [slideWidth, setSlideWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const slidesWrapperRef = useRef<HTMLDivElement>(null);

  const resizeRef = useOnResized((entry) => {
    setContainerWidth(entry.contentRect.width);
  });

  const zoom = useMemo(() => {
    if (slideWidth && containerWidth) {
      // Make it a little smaller to prevent horizontal overflow
      const zoom = containerWidth / slideWidth - 0.01;
      if (!isNaN(zoom)) {
        logger.info('Setting zoom:', zoom);
        return zoom;
      }
    }
    return undefined;
  }, [slideWidth, containerWidth]);

  useChangeEffect(() => {
    if (isLoading) {
      setSanitizedHtml('');
      setCssText('');
    }
  }, [isLoading]);

  useAsyncEffect(
    async ({ signal }) => {
      setIsLoading(true);
      if (url) {
        try {
          let slideCount = 0;
          let totalSlides = 0;

          logger.info('Creating worker for PPT:', url);
          const worker = new Worker(WORKER_URL, { type: 'module' });

          const res = await fetch(url, { signal });
          const file = await res.arrayBuffer();
          worker.addEventListener('message', (e) => {
            const msg = e.data;

            switch (msg.type) {
              case 'progress-update': {
                const progress = msg.data;
                if (totalSlides === 0 && progress) {
                  totalSlides = Math.round(100 / progress);
                }
                logger.info(
                  `Loading progress ${progress.toFixed(2)}% - slide: ${slideCount} / ${totalSlides}`
                );
                break;
              }
              case 'slide':
                slideCount++;
                setSanitizedHtml((html) => html + sanitizeHtml(msg.data));
                break;
              case 'slideSize': {
                // msg.data: { width, height }
                logger.info('Slide size:', msg.data);
                const { width } = msg.data;
                if (!isNaN(width)) setSlideWidth(width);
                break;
              }
              case 'complete':
                logger.info('Completed loading. Duration:', msg.data, 'ms');
                setIsLoading(false);
                break;
              case 'processMsgQueue':
                // TODO charts
                logger.info('(skipping) processMsgQueue items:', msg.data.length);
                // processMsgQueue(msg.data);
                break;
              case 'pptx-thumb':
                // first slide thumbnail
                logger.info('pptx-thumb received', msg.data.length, 'chars');
                break;
              case 'globalCSS':
                logger.info('Added styles:', cssText.length, 'chars');
                setCssText(msg.data);
                break;
              case 'WARN':
                logger.warn(msg.data);
                break;
              case 'ERROR': {
                const error = toError(msg.data);
                logger.error(error);
                setError(error);
                metrics.addCount('PowerPointError');
                break;
              }
              case 'DEBUG':
                logger.debug(msg.data);
                break;
              case 'INFO':
                logger.info(msg.data);
                break;
              default:
                logger.info('Unknown message', msg);
            }
          });

          worker.addEventListener('error', (e) => {
            logger.error('worker:error', e);
          });

          worker.addEventListener('messageerror', (e) => {
            logger.error('worker:messageerror', e);
          });

          worker.postMessage({
            type: 'processPPTX',
            data: file,
          });

          return { worker };
        } catch (err) {
          logger.error('catch', err);
        }
      }
      return {};
    },
    async (returnValue) => {
      const { worker } = await returnValue;
      if (worker) {
        logger.info('Terminating worker for PPT:', url);
        worker.terminate();
      }
    },
    [url]
  );

  useEffect(() => {
    // hide any images that fail to load, e.g., because of unsupported format
    slidesWrapperRef.current?.querySelectorAll('img').forEach((img) => {
      img.onerror = () => {
        img.style.visibility = 'hidden';
        logger.info('Image failed to load', img.src.split(';', 1)[0].substring(0, 24));
      };
    });
  }, [sanitizedHtml]);

  // Use a wrapper within the container to apply CSS zoom
  // And only show the slides once the zoom has been set to prevent jank
  return (
    <div ref={resizeRef} className={styles.container}>
      {error ? (
        <FlexCentered className={styles.errorContainer}>
          <div>
            <Heading level={2}>{t('Error')}</Heading>
            <p>{error.message}</p>
          </div>
        </FlexCentered>
      ) : isLoading ? (
        <FlexCentered>
          <SpinnerIcon size={80} />
        </FlexCentered>
      ) : (
        <>
          <div
            ref={slidesWrapperRef}
            style={{ zoom }}
            className={clsx(styles.wrapper, 'pptx2htmlWrapper')}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          ></div>
          <style>{cssText}</style>
        </>
      )}
    </div>
  );
};

export default PowerPointPreview;

/* TODO: Add chart support
function processMsgQueue(queue: any) {
  for (let i = 0; i < queue.length; i++) {
    processChart(queue[i].data);
  }
}

function processChart(d: any) {
  var chartID = d.chartID;
  var chartType = d.chartType;
  var chartData = d.chartData;

  var data = [];

  var chart = null;
  switch (chartType) {
    case 'lineChart':
      data = chartData;
      chart = nv.models.lineChart().useInteractiveGuideline(true);
      chart.xAxis.tickFormat(function (d: any) {
        return chartData[0].xlabels[d] || d;
      });
      break;
    case 'barChart':
      data = chartData;
      chart = nv.models.multiBarChart();
      chart.xAxis.tickFormat(function (d: any) {
        return chartData[0].xlabels[d] || d;
      });
      break;
    case 'pieChart':
    case 'pie3DChart':
      data = chartData[0].values;
      chart = nv.models.pieChart();
      break;
    case 'areaChart':
      data = chartData;
      chart = nv.models.stackedAreaChart().clipEdge(true).useInteractiveGuideline(true);
      chart.xAxis.tickFormat(function (d: any) {
        return chartData[0].xlabels[d] || d;
      });
      break;
    case 'scatterChart':
      for (var i = 0; i < chartData.length; i++) {
        var arr = [];
        for (var j = 0; j < chartData[i].length; j++) {
          arr.push({ x: j, y: chartData[i][j] });
        }
        data.push({ key: 'data' + (i + 1), values: arr });
      }

      //data = chartData;
      chart = nv.models
        .scatterChart()
        .showDistX(true)
        .showDistY(true)
        .color(d3.scale.category10().range());
      chart.xAxis.axisLabel('X').tickFormat(d3.format('.02f'));
      chart.yAxis.axisLabel('Y').tickFormat(d3.format('.02f'));
      break;
    default:
  }

  if (chart !== null) {
    d3.select('#' + chartID)
      .append('svg')
      .datum(data)
      .transition()
      .duration(500)
      .call(chart);

    nv.utils.windowResize(chart.update);
  }
}
 */
