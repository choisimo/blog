/** DOM-only focus policy. It never invokes a click, changes a value, or traps Tab. */
export interface ToolbarFocusOptions {
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
}

export type ToolbarKeyEvent = Pick<KeyboardEvent,
  'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'defaultPrevented' | 'preventDefault'> & {
    target: EventTarget | null;
    isComposing?: boolean;
  };

function isVisible(element: HTMLElement, root: HTMLElement): boolean {
  if (!element.isConnected || !element.getClientRects().length) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const view = root.ownerDocument.defaultView;
  for (let cursor: HTMLElement | null = element; cursor; cursor = cursor.parentElement) {
    const style = view?.getComputedStyle(cursor);
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return false;
    if (cursor === root) break;
  }
  return true;
}

export function toolbarButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-toolbar-item]'))
    .filter(button => button.closest('[role="toolbar"]') === root);
}

/** Each manager owns only explicit buttons in its own toolbar, not nested widgets. */
export function createToolbarFocusManager(root: HTMLElement, options: ToolbarFocusOptions = {}) {
  const document = root.ownerDocument;
  const view = document.defaultView;
  const originalTabIndices = new Map<HTMLButtonElement, string | null>();
  let current: HTMLButtonElement | null = null;
  let focused: HTMLButtonElement | null = null;
  let previous: HTMLButtonElement[] = [];
  let destroyed = false;
  const enabled = (button: HTMLButtonElement) => !button.disabled && !button.matches(':disabled')
    && button.getAttribute('aria-disabled') !== 'true' && isVisible(button, root);

  const setStop = (button: HTMLButtonElement | null, buttons: HTMLButtonElement[]) => {
    current = button;
    for (const item of buttons) {
      if (!originalTabIndices.has(item)) originalTabIndices.set(item, item.getAttribute('tabindex'));
      const value = item === button ? 0 : -1;
      if (item.tabIndex !== value) item.tabIndex = value;
    }
  };

  const refresh = () => {
    if (destroyed) return;
    const buttons = toolbarButtons(root);
    const candidates = buttons.filter(enabled);
    const active = document.activeElement;
    const activeButton = buttons.find(button => button === active);
    const previousIndex = focused ? previous.indexOf(focused) : -1;
    const lostFocusedButton = focused && (!buttons.includes(focused) || !enabled(focused));
    const next = (activeButton && candidates.includes(activeButton) ? activeButton : null)
      || (current && candidates.includes(current) ? current : null)
      || candidates.find(button => previous.indexOf(button) >= previousIndex && previousIndex >= 0)
      || candidates.find(button => button.getAttribute('aria-pressed') === 'true')
      || candidates[0] || null;
    setStop(next, buttons);
    previous = buttons;
    // A removed/disabled focused button may send focus to body. Do not steal it from another control.
    if (lostFocusedButton && next && (active === focused || active === document.body)) {
      next.focus();
      focused = next;
    } else if (lostFocusedButton) {
      focused = null;
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof (view?.HTMLButtonElement ?? HTMLButtonElement)
      && toolbarButtons(root).includes(event.target as HTMLButtonElement)) {
      focused = event.target as HTMLButtonElement;
      setStop(focused, toolbarButtons(root));
    }
  };
  const onFocusOut = (event: FocusEvent) => {
    // Retain only the browser's "removed/disabled -> body" case until refresh can recover it.
    if (event.relatedTarget && event.relatedTarget !== document.body && event.relatedTarget !== focused) {
      focused = null;
    } else {
      // Chromium emits focusout before remove() has disconnected the button.
      // Decide after that mutation, not from the still-connected pre-removal DOM.
      const departing = focused;
      queueMicrotask(() => {
        if (destroyed || !departing || focused !== departing) return;
        if (!toolbarButtons(root).includes(departing) || !enabled(departing)) refresh();
        else if (document.activeElement !== departing) focused = null;
      });
    }
  };

  const onKeyDown = (event: ToolbarKeyEvent) => {
    if (destroyed || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const buttons = toolbarButtons(root);
    const target = buttons.find(button => button === event.target);
    if (!target || !enabled(target)) return; // Text fields, links and nested toolbars keep their own keys.
    const candidates = buttons.filter(enabled);
    const index = candidates.indexOf(target);
    const vertical = options.orientation === 'vertical';
    const rtl = view?.getComputedStyle(root).direction === 'rtl';
    let nextIndex: number;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = candidates.length - 1;
    else {
      let step = 0;
      if (vertical) {
        if (event.key === 'ArrowDown') step = 1;
        if (event.key === 'ArrowUp') step = -1;
      } else {
        if (event.key === 'ArrowRight') step = rtl ? -1 : 1;
        if (event.key === 'ArrowLeft') step = rtl ? 1 : -1;
      }
      if (!step) return;
      nextIndex = options.loop === false
        ? Math.min(candidates.length - 1, Math.max(0, index + step))
        : (index + step + candidates.length) % candidates.length;
    }
    event.preventDefault();
    const next = candidates[nextIndex];
    setStop(next, buttons);
    next.focus(); // Browser scrolls an overflowed control into view, without executing it.
  };

  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  const observer = view?.MutationObserver ? new view.MutationObserver(refresh) : null;
  observer?.observe(root, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['disabled', 'aria-disabled', 'aria-hidden', 'aria-pressed', 'hidden', 'inert', 'style', 'class', 'data-state'] });
  // An ancestor can become inert/aria-hidden without changing the toolbar's size.
  // Observe only ancestor attributes, not the document's entire subtree.
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
    observer?.observe(ancestor, { attributes: true,
      attributeFilter: ['disabled', 'aria-hidden', 'hidden', 'inert', 'style', 'class'] });
  }
  const resize = view?.ResizeObserver ? new view.ResizeObserver(refresh) : null;
  resize?.observe(root);
  view?.addEventListener('resize', refresh);
  refresh();
  return {
    onKeyDown,
    refresh,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      resize?.disconnect();
      view?.removeEventListener('resize', refresh);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      for (const [button, tabIndex] of originalTabIndices) {
        if (tabIndex === null) button.removeAttribute('tabindex');
        else button.setAttribute('tabindex', tabIndex);
      }
    },
  };
}
