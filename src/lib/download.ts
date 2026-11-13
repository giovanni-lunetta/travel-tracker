/** Saving and reading files in the browser. */

/**
 * Saves text as a file. On phones this opens the share sheet ("Save to Files"),
 * which is the reliable way to keep a file from an installed web app; on
 * desktop it downloads normally.
 */
export async function saveTextFile(filename: string, text: string, mime = 'application/json'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], filename, { type: mime });
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return 'cancelled';
      // fall through to a normal download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export const readFileText = (file: File): Promise<string> => file.text();

/** Today's date as YYYY-MM-DD in the user's own timezone (not UTC, which can be tomorrow). */
export const todayStamp = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
