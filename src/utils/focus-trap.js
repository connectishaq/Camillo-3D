const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside `root` (for modal dialogs): Tab and Shift+Tab wrap around.
 * Returns a function that removes the trap and gives focus back to whatever had it before.
 */
export function trapFocus(root) {
  const previous = document.activeElement;
  const focusables = () => [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden]') && el.getClientRects().length);

  const onKeydown = (e) => {
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const outside = !root.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || outside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || outside)) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeydown);

  return () => {
    document.removeEventListener('keydown', onKeydown);
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  };
}
