import { ActionToolbar } from '@/components/ui/action-toolbar';

interface PaneOption<T extends string> { id: T; label: string; controls: string; disabled?: boolean; }
interface PaneSwitcherProps<T extends string> {
  label: string;
  value: T;
  options: readonly PaneOption<T>[];
  onChange: (value: T) => void;
}

/** Toggle buttons, not ARIA tabs: desktop can show more than one pane simultaneously. */
export function PaneSwitcher<T extends string>({ label, value, options, onChange }: PaneSwitcherProps<T>) {
  return (
    <ActionToolbar className="ui-pane-switcher" label={label}>
      {options.map(option => (
        <button key={option.id} type="button" data-toolbar-item="" disabled={option.disabled} aria-pressed={value === option.id}
          aria-controls={option.controls} onClick={() => { if (value !== option.id) onChange(option.id); }}>
          {option.label}
        </button>
      ))}
    </ActionToolbar>
  );
}
