"use client";

/**
 * Shared load state for the console's fetching screens.
 *
 * Two things it exists to get right:
 *
 *   1. The fetch is started off the synchronous effect body, so React is
 *      not asked to re-render in the middle of committing one.
 *   2. Every load carries a liveness check. When filters change quickly
 *      an earlier request can still be in flight; without the check its
 *      late response would overwrite the newer one and the table would
 *      show results for a filter the reviewer has already changed.
 */

import { useCallback, useEffect, useState } from "react";

export type LoadStatus = "loading" | "ready" | "error";

export interface AsyncLoad {
  status: LoadStatus;
  error: string;
  /** Re-run the loader, for a retry button. */
  reload: () => void;
}

export function useAsyncLoad(
  loader: (isActive: () => boolean) => Promise<void>,
  fallbackMessage: string,
): AsyncLoad {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const isActive = () => active;

    void (async () => {
      // Yield once so no state update happens inside the effect body.
      await Promise.resolve();
      if (!isActive()) return;
      setStatus("loading");
      setError("");
      try {
        await loader(isActive);
        if (isActive()) setStatus("ready");
      } catch (caught) {
        if (!isActive()) return;
        setError(caught instanceof Error ? caught.message : fallbackMessage);
        setStatus("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [loader, fallbackMessage, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { status, error, reload };
}

/** Read a JSON response, raising the server's message on failure. */
export async function readJson(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? fallback);
  return body;
}
