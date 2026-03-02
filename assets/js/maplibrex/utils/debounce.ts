/**
 * Debounce utility - delays function execution until after a wait period
 * 
 * Useful for optimizing frequent events like map movements, zoom changes, etc.
 * Reduces the number of calls to expensive operations or server round-trips.
 * 
 * @param func - The function to debounce
 * @param wait - The delay in milliseconds
 * @returns Debounced version of the function
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle utility - ensures function is called at most once per wait period
 * 
 * Unlike debounce, throttle guarantees the function is called regularly
 * during a continuous event stream.
 * 
 * @param func - The function to throttle
 * @param wait - The minimum delay between calls in milliseconds
 * @returns Throttled version of the function
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    lastArgs = args;
    
    if (timeout === null) {
      func.apply(context, args);
      lastArgs = null;
      
      timeout = setTimeout(() => {
        timeout = null;
        if (lastArgs !== null) {
          func.apply(context, lastArgs);
          lastArgs = null;
        }
      }, wait);
    }
  };
}
