export function bindPress(element, handler) {
  if (!element || typeof handler !== 'function') return () => {};
  let lastActivation = 0;

  const activate = event => {
    const now = Date.now();
    if (now - lastActivation < 450) return;
    lastActivation = now;
    if (event.type !== 'click') event.preventDefault?.();
    handler(event);
  };

  const activatePointer = event => {
    if (event.pointerType === 'mouse') return;
    activate(event);
  };

  const pointerSupported = typeof window !== 'undefined' && typeof window.PointerEvent === 'function';
  if (pointerSupported) element.addEventListener('pointerup', activatePointer);
  element.addEventListener('touchend', activate, { passive: false });
  element.addEventListener('click', activate);

  return () => {
    if (pointerSupported) element.removeEventListener('pointerup', activatePointer);
    element.removeEventListener('touchend', activate, { passive: false });
    element.removeEventListener('click', activate);
  };
}
