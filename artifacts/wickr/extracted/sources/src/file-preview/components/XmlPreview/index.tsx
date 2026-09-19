import { clsx } from 'clsx';
import { Fragment, useReducer, useState } from 'react';
import { FileLoading } from '../FileLoading';
import { Button } from '@/componentlibrary';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import { Logger } from '@/lib/logger';
import { asElement, isNode } from '@/utils/dom';
import { SafeError } from '@/utils/error';

import styles from './styles.module.less';

const logger = new Logger('XmlPreview');

type Attr = {
  name: string;
  value: string;
};

const XmlAttributes: ReactFC<{ attrs: Attr[] | NamedNodeMap | undefined }> = ({ attrs = [] }) => {
  return [...attrs].map((attr) => {
    return (
      <Fragment key={attr.name}>
        {' '}
        <span className={styles.attrName}>{attr.name}</span>="
        <span className={styles.attrValue}>{attr.value}</span>"
      </Fragment>
    );
  });
};

/** Max child nodes to render before showing a "more" button */
const INITIAL_MAX_CHILDREN = 100;
/** Additional child nodes to render when clicking "more" button */
const NEXT_CHILDREN = 100;
/** Maximum depth to expand. After which users will need to click to expand */
const INITIAL_MAX_DEPTH_OPEN = 6;

const toggleReducer = (state: boolean) => !state;

function nodeName(node: Node) {
  // Prefer localName when available
  // If the node is an HTML element, nodeName is uppercase while localName is lowercase
  return asElement(node)?.localName ?? node.nodeName;
}

const XmlNode: ReactFC<{ node: Node | null | undefined; depth?: number }> = ({
  node,
  depth = 0,
}) => {
  const [maxChildren, setMaxChildren] = useState(INITIAL_MAX_CHILDREN);
  // Used for initial state of the open attribute. HTML tracks this state itself.
  const unmanagedOpen = depth <= INITIAL_MAX_DEPTH_OPEN;
  // Used to determine when to render children, which React controls.
  // Listening to onToggle has bubbling issues, so we simply deal with summary clicks.
  const [open, toggleOpen] = useReducer(toggleReducer, unmanagedOpen);

  if (!isNode(node)) return null;

  const childNodes = node.hasChildNodes() ? [...node.childNodes] : undefined;

  const renderChildren = () => {
    if (!open) return null;

    return childNodes?.map((node, i) => {
      if (i < maxChildren) {
        return <XmlNode node={node} key={i} depth={depth + 1} />;
      } else if (i === maxChildren) {
        const remaining = childNodes.length - maxChildren;
        const next = Math.min(NEXT_CHILDREN, remaining);
        return (
          <div key={`show-next-${i}`}>
            <Button
              shape="rounded"
              bordered
              onClick={() => setMaxChildren((max) => max + INITIAL_MAX_CHILDREN)}
            >
              Show next {next} of {remaining}
            </Button>
          </div>
        );
      } else {
        return null;
      }
    });
  };

  // https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
  switch (node.nodeType) {
    case Node.DOCUMENT_NODE: {
      const { xmlEncoding, xmlVersion, xmlStandalone } = node as any;
      const attrs: Attr[] = [];
      if (xmlEncoding) attrs.push({ name: 'encoding', value: xmlEncoding });
      if (xmlVersion) attrs.push({ name: 'version', value: xmlVersion });
      if (xmlStandalone === 'yes') attrs.push({ name: 'standalone', value: 'yes' });
      return (
        <details open={unmanagedOpen}>
          <summary className={styles.tag} onClick={toggleOpen}>
            &lt;?xml
            <XmlAttributes attrs={attrs} />
            ?&gt;
          </summary>
          {renderChildren()}
        </details>
      );
    }
    case Node.ELEMENT_NODE: {
      if (asElement(node)?.childElementCount) {
        // If a node has child elements, it should expand/collapse
        return (
          <details open={unmanagedOpen}>
            <summary className={styles.tag} onClick={toggleOpen}>
              &lt;{nodeName(node)}
              <XmlAttributes attrs={asElement(node)?.attributes} />
              &gt;
            </summary>
            {renderChildren()}
            <span className={clsx(styles.tag, styles.closing)}>&lt;/{nodeName(node)}&gt;</span>
          </details>
        );
      } else if (childNodes) {
        // If it has child nodes but not elements, the children are text, and there isn't a need to collapse
        return (
          <div className={clsx(styles.tag, styles.static)}>
            &lt;{nodeName(node)}
            <XmlAttributes attrs={asElement(node)?.attributes} />
            &gt;
            {renderChildren()}
            <span className={styles.tag}>&lt;/{nodeName(node)}&gt;</span>
          </div>
        );
      } else {
        // If there are no children at all, render it as a self-closing tag
        return (
          <div className={clsx(styles.tag, styles.static)}>
            &lt;{nodeName(node)}
            <XmlAttributes attrs={asElement(node)?.attributes} />
            /&gt;
          </div>
        );
      }
    }
    case Node.TEXT_NODE: {
      return <span className={styles.text}>{node.textContent}</span>;
    }
    case Node.COMMENT_NODE: {
      return <div className={styles.comment}>{`<!-- ${node.textContent} -->`}</div>;
    }
    case Node.CDATA_SECTION_NODE: {
      return <div>{`<![CDATA[ ${node.textContent} ]]>`}</div>;
    }
    case Node.PROCESSING_INSTRUCTION_NODE: {
      return (
        <div className={styles.tag}>
          {`<?`}
          {nodeName(node)}
          {node.nodeValue ? ` ${node.nodeValue}` : ''}
          {`?>`}
        </div>
      );
    }
    case Node.DOCUMENT_TYPE_NODE: {
      if (!(node instanceof DocumentType)) return null;
      return (
        <div className={styles.tag}>
          {`<!DOCTYPE `}
          {node.name}{' '}
          {node.publicId
            ? `PUBLIC "${node.publicId}" "${node.systemId}"`
            : node.systemId
            ? `SYSTEM "${node.systemId}"`
            : ''}
          {`>`}
        </div>
      );
    }
    default:
      logger.info('No handler for node type:', node.nodeType);
      return null;
  }
};

const XmlPreview: ReactFC<{ url: string }> = ({ url }) => {
  // undefined = loading
  // Document/Node = success
  // Error = failure
  const [rootOrError, setRootOrError] = useState<undefined | Node | Error>();

  useAsyncEffect(
    async ({ signal }) => {
      // loading
      setRootOrError(undefined);

      // Don't catch this because it may get aborted
      const res = await fetch(url, { signal });
      try {
        const xmlText = await res.text();
        const parser = new DOMParser();

        // Attempt to use the XML parser, which preserves the XML exactly.
        // If it is invalid, the parser returns a document with a <parsererror>.
        // If that exists, the fallback to use an HTML parser, which is much
        // more forgiving, but renders slightly differently (tag case name is lost).
        // The parsers are very fast. The XML parser takes 11ms on a 500K file.
        // If we detect that this is an HTML document (naive) then start with text/html
        const isHtml = xmlText.includes('<body') || xmlText.includes('<BODY');
        let doc = parser.parseFromString(xmlText, isHtml ? 'text/html' : 'text/xml');
        let rootNode: Node = doc;
        if (!isHtml && doc.querySelector('parsererror')) {
          doc = parser.parseFromString(xmlText, 'text/html');
          // If we redo as HTML then the root node gets put inside the <body> tag
          rootNode = doc.body?.firstChild ?? doc;
        }
        setRootOrError(rootNode);
        if (__DEV__) Object.assign(globalThis, { doc });
      } catch (err) {
        logger.error(err);
        // If there is an error handling the response
        const error = new SafeError(err);
        setRootOrError(error);
      }
    },
    [url]
  );

  return (
    <div className={styles.container}>
      {!rootOrError ? (
        <FileLoading />
      ) : rootOrError instanceof Error ? (
        <code>{rootOrError.message}</code>
      ) : (
        <XmlNode node={rootOrError} />
      )}
    </div>
  );
};
export default XmlPreview;
