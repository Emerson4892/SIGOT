export const cacheRuntime = [];

export function rutaApiAutenticada(pathname) {
  return pathname.startsWith('/api/');
}
