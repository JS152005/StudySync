/**
 * Detects whether the Document Picture-in-Picture API is supported at runtime.
 * Document Picture-in-Picture allows opening an always-on-top window populated
 * with arbitrary HTML content.
 *
 * Browser compatibility note:
 * - Chromium browsers (Chrome 116+, Edge 116+, Opera, Brave): Supported.
 * - Firefox & Safari: Not supported (falls back to the in-app floating dock).
 *
 * @param targetWindow Optional window instance to test (defaults to global window)
 */
export function isDocumentPipSupported(targetWindow?: any): boolean {
  const win = targetWindow !== undefined ? targetWindow : (typeof window !== 'undefined' ? window : undefined);
  return Boolean(win && 'documentPictureInPicture' in win && win.documentPictureInPicture);
}
