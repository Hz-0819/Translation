export function bindPress(element, handler) {
  if (!element || typeof handler !== 'function') return () => {};
  let lastActivation = 0;

  const activate = event => {
    if (event.type === 'pointerup' && event.button != null && event.button !== 0) return;
    const now = Date.now();
    if (now - lastActivation < 450) return;
    lastActivation = now;
    event.preventDefault?.();
    handler(event);
  };

  const pointerSupported = typeof window !== 'undefined' && typeof window.PointerEvent === 'function';
  if (pointerSupported) element.addEventListener('pointerup', activate);
  element.addEventListener('touchend', activate, { passive: false });
  element.addEventListener('click', activate);

  return () => {
    if (pointerSupported) element.removeEventListener('pointerup', activate);
    element.removeEventListener('touchend', activate, { passive: false });
    element.removeEventListener('click', activate);
  };
}
