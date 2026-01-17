// Request deduplication utility
// Prevents duplicate concurrent API calls by returning the same promise for identical requests

// Map to track in-flight requests by their key
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Generate a cache key from function arguments
 */
function generateKey(fnName: string, args: unknown[]): string {
  try {
    return `${fnName}:${JSON.stringify(args)}`;
  } catch {
    // If args can't be stringified, use toString
    return `${fnName}:${args.map(a => String(a)).join(',')}`;
  }
}

/**
 * Wrap an async function to deduplicate concurrent calls with the same arguments.
 * If a request is already in-flight, returns the existing promise instead of making a new request.
 *
 * @param fn - The async function to wrap
 * @param fnName - A name for the function (used in the cache key)
 * @returns A wrapped function that deduplicates concurrent calls
 *
 * @example
 * const fetchProfilesDeduped = deduplicate(fetchAllProfiles, 'fetchAllProfiles');
 * // These two calls will only make ONE API request
 * const [result1, result2] = await Promise.all([
 *   fetchProfilesDeduped('us-south'),
 *   fetchProfilesDeduped('us-south'),
 * ]);
 */
export function deduplicate<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  fnName: string
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const key = generateKey(fnName, args);

    // Check if there's already an in-flight request for this key
    const existingRequest = inFlightRequests.get(key) as Promise<T> | undefined;
    if (existingRequest) {
      return existingRequest;
    }

    // Create the new request
    const request = fn(...args).finally(() => {
      // Remove from in-flight requests when done (success or error)
      inFlightRequests.delete(key);
    });

    // Store in the map
    inFlightRequests.set(key, request);

    return request;
  };
}

/**
 * Create a deduplicated version of a function with a custom key generator.
 * Useful when the default JSON.stringify key generation isn't suitable.
 *
 * @param fn - The async function to wrap
 * @param keyFn - A function that generates a cache key from the arguments
 * @returns A wrapped function that deduplicates concurrent calls
 */
export function deduplicateWithKey<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  keyFn: (...args: Args) => string
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const key = keyFn(...args);

    const existingRequest = inFlightRequests.get(key) as Promise<T> | undefined;
    if (existingRequest) {
      return existingRequest;
    }

    const request = fn(...args).finally(() => {
      inFlightRequests.delete(key);
    });

    inFlightRequests.set(key, request);

    return request;
  };
}

/**
 * Clear all in-flight requests (useful for testing)
 */
export function clearInFlightRequests(): void {
  inFlightRequests.clear();
}

/**
 * Get the count of in-flight requests (useful for debugging)
 */
export function getInFlightCount(): number {
  return inFlightRequests.size;
}
