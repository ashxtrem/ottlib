import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSuccessPulse } from '../hooks/useSuccessPulse';
import { focusRing, pressable } from './interactionStyles';

interface ApiKeyFieldProps {
  id: string;
  name: string;
  label: string;
  maskedValue: string;
  help?: ReactNode;
  required?: boolean;
  testing?: boolean;
  testSuccess?: boolean;
  onTest?: (value: string) => void;
}

export function ApiKeyField({ id, name, label, maskedValue, help, required = false, testing, testSuccess = false, onTest }: ApiKeyFieldProps) {
  const [replacing, setReplacing] = useState(false);
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const tested = useSuccessPulse(testSuccess);

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

  const secondaryButton = `rounded-lg border border-border-strong px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-fast ease-emphasis hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${pressable}`;
  return <div id={id} className="block text-sm">
    {replacing ? <label htmlFor={`${id}-input`}>{label}</label> : <span>{label}</span>}
    <div className={`mt-1 grid transition-[grid-template-rows] duration-base ease-standard ${replacing ? 'grid-rows-[1fr]' : 'grid-rows-[1fr]'}`}><div className="min-h-0 overflow-hidden">{replacing ? <div className="flex flex-col gap-2 animate-fade-in sm:flex-row">
      <input id={`${id}-input`} ref={input} name={name} type="password" value={value} onChange={(event) => setValue(event.target.value)} placeholder={`Paste a new ${label}`} autoComplete="new-password" required={required} className={`min-w-0 flex-1 rounded-lg border border-border bg-field px-3 py-2 ${focusRing}`} />
      {onTest && <button type="button" onClick={() => onTest(value)} disabled={testing} className={`${secondaryButton} ${tested ? 'border-success bg-success text-success-foreground hover:bg-success' : ''}`}>{testing ? 'Testing…' : tested ? 'Tested' : 'Test key'}</button>}
      <button type="button" onClick={cancelReplacing} className={`rounded-lg px-4 py-2 text-sm font-medium text-muted transition-[background-color,transform,color] duration-fast ease-emphasis hover:bg-surface-raised hover:text-foreground ${focusRing} ${pressable}`}>Cancel</button>
    </div> : <div className="flex flex-wrap items-center gap-2 animate-fade-in">
      <span className="rounded-lg border border-border bg-field px-3 py-2 font-mono text-sm text-muted">{maskedValue || 'No key added'}</span>
      {onTest && maskedValue && <button type="button" onClick={() => onTest(maskedValue)} disabled={testing} className={`${secondaryButton} ${tested ? 'border-success bg-success text-success-foreground hover:bg-success' : ''}`}>{testing ? 'Testing…' : tested ? 'Tested' : 'Test key'}</button>}
      <button type="button" onClick={beginReplacing} className={secondaryButton}>{maskedValue ? 'Replace key' : 'Add key'}</button>
    </div>}</div></div>
    {help && <div className="mt-1 text-xs text-muted">{help}</div>}
  </div>;
}
