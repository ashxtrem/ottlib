import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ApiKeyFieldProps {
  id: string;
  name: string;
  label: string;
  maskedValue: string;
  help?: ReactNode;
  required?: boolean;
  testing?: boolean;
  onTest?: (value: string) => void;
}

export function ApiKeyField({ id, name, label, maskedValue, help, required = false, testing, onTest }: ApiKeyFieldProps) {
  const [replacing, setReplacing] = useState(false);
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReplacing(false);
    setValue('');
  }, [maskedValue]);

  useEffect(() => {
    if (replacing) input.current?.focus();
  }, [replacing]);

  const beginReplacing = () => {
    setValue('');
    setReplacing(true);
  };
  const cancelReplacing = () => {
    setValue('');
    setReplacing(false);
  };

  return <div id={id} className="block text-sm">
    {replacing ? <label htmlFor={`${id}-input`}>{label}</label> : <span>{label}</span>}
    {replacing ? <div className="mt-1 flex flex-col gap-2 sm:flex-row">
      <input id={`${id}-input`} ref={input} name={name} type="password" value={value} onChange={(event) => setValue(event.target.value)} placeholder={`Paste a new ${label}`} autoComplete="new-password" required={required} className="min-w-0 flex-1 rounded-lg border border-border bg-field px-3 py-2" />
      {onTest && <button type="button" onClick={() => onTest(value)} disabled={testing} className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{testing ? 'Testing…' : 'Test key'}</button>}
      <button type="button" onClick={cancelReplacing} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-surface-raised hover:text-foreground">Cancel</button>
    </div> : <div className="mt-1 flex flex-wrap items-center gap-2">
      <span className="rounded-lg border border-border bg-field px-3 py-2 font-mono text-sm text-muted">{maskedValue || 'No key added'}</span>
      {onTest && maskedValue && <button type="button" onClick={() => onTest(maskedValue)} disabled={testing} className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{testing ? 'Testing…' : 'Test key'}</button>}
      <button type="button" onClick={beginReplacing} className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">{maskedValue ? 'Replace key' : 'Add key'}</button>
    </div>}
    {help && <div className="mt-1 text-xs text-muted">{help}</div>}
  </div>;
}
