// !!! DO NOT IMPORT ANYTHING !!!
// !!! DO NOT IMPORT ANYTHING !!!
// !!! DO NOT IMPORT ANYTHING !!!
// !!! DO NOT IMPORT ANYTHING !!!
//
// - This code runs before anything else
// - We leverage console logging here because Qt picks it up anyway
// - Qt prunes console.log, so leverage console.info
// - Any redactions must be done manually
// - This code is loaded via index.html and is hoisted to <head> during build

const isTop = typeof window === 'object' ? window.top === window : true;

// Generate the log prefix safely
function getLogPrefix() {
  const prefixes = ['Preebootstap'];
  try {
    // Add the fileName if loaded in an iframe, so we can differentiate from main
    const fileName = location.pathname.replace(/^.*\//, '').replace('.html', '');
    if (!isTop && fileName) prefixes.push(fileName);
  } catch {
    // no-op
  }
  return `[${prefixes.join(':')}]`;
}
const LOG_PREFIX = getLogPrefix();
const logInfo = console.info.bind(console, LOG_PREFIX);
const logWarn = console.warn.bind(console, LOG_PREFIX);
const logError = console.error.bind(console, LOG_PREFIX);

logInfo('App Path:', location.pathname);
logInfo('Build version:', __COMMIT_ID__ ?? 'unknown');
try {
  logInfo('Build time:', new Date(__BUILD_TIMESTAMP__).toISOString());
} catch {
  logInfo('Build time: Invalid date');
}

if (__DEV__) {
  // Use onerror in dev because the logged info links back to TS better
  onerror = (event, _source, _lineno, _colno, error) => {
    try {
      // If React is working, render via DevErrorBanner
      if (document.getElementById('dev_error_banner')) return;

      // Otherwise a fatal error was encountered, fallback to DOM rendering
      const el = document.createElement('code');
      el.textContent = `${error?.stack || error || event}

See console for details. `;
      const btn = document.createElement('button');
      btn.textContent = 'Reload';
      // eslint-disable-next-line no-restricted-syntax
      btn.onclick = () => location.reload();
      el.append(btn);
      (document.body ?? document.documentElement).append(el);
    } catch {
      // no-op
    }
  };
}

function observeDocumentElement() {
  try {
    const ro = new ResizeObserver((entries) => {
      try {
        const [doc] = entries;
        if (doc) {
          const { x, y, width, height } = doc.contentRect;
          logInfo('Document: dimensions:', JSON.stringify({ x, y, width, height }));
        }
      } catch {
        // no-op
      }
    });
    ro.observe(document.documentElement);

    const io = new IntersectionObserver(
      (entries) => {
        try {
          const [doc] = entries;
          if (doc) {
            logInfo('Document: in view?', doc.isIntersecting);
          }
        } catch {
          // no-op
        }
      },
      { threshold: 0 }
    );
    io.observe(document.documentElement);

    logInfo('Document: observing');

    return () => {
      ro.disconnect();
      io.disconnect();
    };
  } catch {
    return () => {};
  }
}

if (isTop) observeDocumentElement();
