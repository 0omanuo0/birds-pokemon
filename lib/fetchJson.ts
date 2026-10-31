// fetch with a timeout and retries, for the Wikipedia/eBird/Nominatim calls that used to hang or cache a failure.
// Retries network errors, timeouts, 429 and 5xx (honouring Retry-After, capped); any other status comes back as is
// so the caller can tell "not found" (404) from "failed".

const RETRY_STATUS = (status: number) => status === 429 || status >= 500;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchRetry(
    url: string,
    init: RequestInit = {},
    { timeout = 8000, retries = 1, backoff = 500 }: { timeout?: number; retries?: number; backoff?: number } = {}
): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const signal = init.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)])
                : AbortSignal.timeout(timeout);
            const response = await fetch(url, { ...init, signal });
            if (!RETRY_STATUS(response.status) || attempt === retries) return response;
            const retryAfter = Number(response.headers.get("retry-after"));
            await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : backoff * 2 ** attempt);
        } catch (error) {
            // the caller aborted on purpose: don't retry
            if (init.signal?.aborted) throw error;
            lastError = error;
            if (attempt === retries) throw error;
            await wait(backoff * 2 ** attempt);
        }
    }
    throw lastError;
}
