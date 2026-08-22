const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);

export function useIsLocalClient(): boolean {
  return localHostnames.has(location.hostname);
}
