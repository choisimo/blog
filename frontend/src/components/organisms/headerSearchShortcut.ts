type SearchShortcutEvent = Pick<KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'isComposing' | 'defaultPrevented' | 'repeat'>;

/** Retain HeaderSearchBar's shortcuts while its dialog is unmounted. */
export function isHeaderSearchShortcut(event: SearchShortcutEvent, isEditable: boolean): boolean {
  if (isEditable || event.defaultPrevented || event.isComposing || event.repeat) return false;
  return (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey)
    || ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey));
}
