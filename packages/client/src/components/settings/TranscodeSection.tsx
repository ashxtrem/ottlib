import type { TranscodeEncoder, TranscodeEncoders } from '@ottlib/shared';
import { transcodeEncoderOptions, transcodeStatusLine } from './transcodeLabels';

type TranscodeSectionProps = {
  value: TranscodeEncoder;
  onChange: (value: TranscodeEncoder) => void;
  saving: boolean;
  /** Undefined while GET /api/transcode/encoders loads. */
  status: TranscodeEncoders | undefined;
  statusError?: string;
};

/** Web player transcode settings: the encoder choice and what the server's ffmpeg offers. */
export function TranscodeSection({ value, onChange, saving, status, statusError }: TranscodeSectionProps) {
  return <section aria-labelledby="transcode-heading" className="rounded-xl border border-border bg-surface p-5">
    <h2 id="transcode-heading" className="font-semibold">Web player transcoding</h2>
    <p className="mt-1 text-sm text-muted">Used when the browser can't play a file directly. A forced encoder that fails falls back to Auto.</p>
    <label className="mt-3 block text-sm">
      Video encoder
      <select value={value} disabled={saving} onChange={(event) => onChange(event.target.value as TranscodeEncoder)} className="mt-1 block w-full rounded-lg border border-border bg-field px-3 py-2 disabled:opacity-60 md:max-w-sm">
        {transcodeEncoderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <TranscodeStatus status={status} error={statusError} />
  </section>;
}

function TranscodeStatus({ status, error }: { status: TranscodeEncoders | undefined; error?: string }) {
  if (error) return <p role="alert" className="mt-3 text-sm text-error">{error}</p>;
  if (!status) return <p className="mt-3 text-sm text-muted">Checking ffmpeg…</p>;
  if (!status.available) return <div className="mt-3 rounded-lg border border-warning-border/50 bg-warning-soft p-3">
    <p className="text-sm font-medium text-warning">ffmpeg not found</p>
    <p className="mt-1 text-xs text-muted">The full server bundle ships ffmpeg; otherwise install ffmpeg and put it on the server's PATH, then restart the server.</p>
  </div>;
  return <p role="status" className="mt-3 text-sm text-muted">{transcodeStatusLine(status)}</p>;
}
