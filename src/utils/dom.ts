import logger from './logger';

/**
 * Waits for an element matching the querySelector to appear in the DOM
 * @param querySelector CSS selector to find the element
 * @param timeout Optional timeout in milliseconds
 * @returns Promise resolving to the found element or null if timeout reached
 */
export async function waitForElement<T extends Element>(
  querySelector: string,
  timeout: number,
): Promise<T | null> {
  const existingElement = document.querySelector<T>(querySelector);
  if (existingElement) return existingElement;

  return new Promise<T | null>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const observer = new MutationObserver(() => {
      const element = document.querySelector<T>(querySelector);
      if (element) {
        cleanup();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    if (timeout) {
      timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeout);
    }

    function cleanup() {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    }
  });
}

/**
 * Gets the RFC verification token from cookies
 * This is used for CSRF protection in Torn API requests
 * @returns The RFC token value or empty string if not found
 */
export function getRFC(): string {
  try {
    const match = document.cookie.match(/(?:^|;\s*)rfc_v=([^;]*)/);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  } catch (e) {
    logger.error('Error getting RFC token:', e);
    return '';
  }
}

/**
 * Parses URL hash into URLSearchParams
 * Handles various hash formats used in Torn's frontend
 * @param hash Optional hash string, defaults to current location.hash
 * @returns URLSearchParams object containing the parsed parameters
 */
export function getHashParameters(hash?: string): URLSearchParams {
  // Potentially "borrowed" from TornTools?
  // Really sorry if that's the case, it's been a long time since I made this :(
  let finalHash = hash || location.hash;

  if (finalHash.startsWith('#/')) {
    finalHash = finalHash.substring(2);
  } else if (finalHash.startsWith('#') || finalHash.startsWith('/')) {
    finalHash = finalHash.substring(1);
  }

  if (!finalHash.startsWith('!') && !finalHash.startsWith('?')) {
    finalHash = `?${finalHash}`;
  }

  return new URLSearchParams(finalHash);
}

/**
 * Waits for the page to become idle
 */
export function waitForDocumentReady(): Promise<void> {
  return new Promise((resolve) => {
    if (
      document.readyState === 'complete' ||
      document.readyState === 'interactive'
    ) {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', () => resolve());
    }
  });
}

/**
 * Fetches the ID of the currently logged in user via the user burger dropdown
 * @returns The current user ID or null if not found or malformed
 */
export async function getLocalUserId(): Promise<string | null> {
  const name = await waitForElement<HTMLAnchorElement>(
    '.settings-menu > .link > a:first-child',
    15_000,
  );

  if (!name || !name.href) {
    logger.debug('Failed to find the XID element.');
    return null;
  }

  try {
    const params = new URL(name.href).searchParams;
    return params.get('XID');
  } catch {
    logger.debug('User XID is malformed');
    return null;
  }
}
