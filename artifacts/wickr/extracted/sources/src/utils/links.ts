import { DATASET_NOCONFIRM } from '@/componentlibrary/ExternalLink';

/**
 * Determines whether a link click on an anchor element should show
 * the "You are leaving Wickr" confirmation dialog.
 */
export function shouldShowLinkConfirmation(anchor: HTMLAnchorElement): boolean {
  const url = new URL(anchor.href);
  const textContent = anchor.textContent?.trim() ?? '';
  // The browser normalizes href (e.g., adds trailing slash), so compare
  // both the normalized href and the original text to handle cases like
  // "https://example.com" vs "https://example.com/"
  const textMatchesHref = textContent === anchor.href || textContent + '/' === anchor.href;
  return (
    anchor.dataset[DATASET_NOCONFIRM] !== 'true' && !textMatchesHref && url.protocol !== 'mailto:'
  );
}
