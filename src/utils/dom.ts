import logger from "./logger";
import type { PlayerId } from "./types";

const ID_PARAMS = ["XID", "user2ID"];

export function extract_id_from_url(url: string): PlayerId | null {
  const parsed = new URL(url);
  const search = new URLSearchParams(parsed.search);

  for (const param of ID_PARAMS) {
    const v = search.get(param);
    if (v) {
      return parseInt(v, 10);
    }
  }

  return null;
}

export function torn_page(page: string, sid?: string) {
  const url_match = window.location.href.startsWith(
    `https://www.torn.com/${page}.php`,
  );
  let sid_match = true;
  if (sid) {
    const search = new URLSearchParams(window.location.search);
    const page_sid = search.get("sid");
    sid_match = page_sid !== null && sid === page_sid;
  }

  return url_match && sid_match;
}

/**
 * Waits for an element matching the querySelector to appear in the DOM
 * @param querySelector CSS selector to find the element
 * @param timeout Optional timeout in milliseconds
 * @returns Promise resolving to the found element or null if timeout reached
 */
export async function wait_for_element<T extends Element>(
  querySelector: string,
  timeout: number,
  root?: Node,
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

    if (!root) {
      root = document.body;
    }
    observer.observe(root, {
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

export async function wait_for_body(timeout: number): Promise<boolean> {
  const body = await wait_for_element(
    "body",
    timeout,
    document.documentElement,
  );
  return body !== null;
}

/**
 * Gets the RFC verification token from cookies
 * This is used for CSRF protection in Torn API requests
 * @returns The RFC token value or empty string if not found
 */
export function getRFC(): string {
  try {
    const match = document.cookie.match(/(?:^|;\s*)rfc_v=([^;]*)/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch (e) {
    logger.error("Error getting RFC token:", e);
    return "";
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

  if (finalHash.startsWith("#/")) {
    finalHash = finalHash.substring(2);
  } else if (finalHash.startsWith("#") || finalHash.startsWith("/")) {
    finalHash = finalHash.substring(1);
  }

  if (!finalHash.startsWith("!") && !finalHash.startsWith("?")) {
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
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      resolve();
    } else {
      document.addEventListener("DOMContentLoaded", () => resolve());
    }
  });
}

/**
 * Fetches the ID of the currently logged in user via the user burger dropdown
 * @returns The current user ID or null if not found or malformed
 */
export async function getLocalUserId(): Promise<string | null> {
  const name = await wait_for_element<HTMLAnchorElement>(
    ".settings-menu > .link > a:first-child",
    15_000,
  );

  if (!name || !name.href) {
    logger.debug("Failed to find the XID element.");
    return null;
  }

  try {
    const params = new URL(name.href).searchParams;
    return params.get("XID");
  } catch {
    logger.debug("User XID is malformed");
    return null;
  }
}
export function create_info_line() {
  const info_line = document.createElement("div");
  info_line.className = "ffsv3-info-line";
  info_line.style.display = "block";
  info_line.style.clear = "both";
  info_line.style.margin = "5px 0";

  return info_line;
}
