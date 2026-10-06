/**
 * Hands the browser a file to save - the calendar of reminders, a backup.
 * Made in the page, never sent anywhere: a link to the text as a blob,
 * clicked, then let go.
 */
export function downloadFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
