import { afterEach } from "vitest";

/*
 * Shared by every test file. The UI parts only switch on where there's a
 * DOM - the logic tests run on plain Node and skip them.
 */
if (typeof window !== "undefined") {
  // toBeInTheDocument(), toHaveAttribute() and the rest.
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");

  // jsdom has <dialog> but not its modal methods; the app's Sheet and Modal
  // call them when they open. Enough of a stand-in to toggle `open`.
  const dialog = window.HTMLDialogElement?.prototype;
  if (dialog && !dialog.showModal) {
    dialog.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
    dialog.close = function (this: HTMLDialogElement) {
      this.open = false;
    };
  }

  // Each test starts from an empty page and empty browser storage.
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
}
