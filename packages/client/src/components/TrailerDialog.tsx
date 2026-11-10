import { Modal } from './Modal';

export function trailerEmbedUrl(trailerKey: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}?autoplay=1`;
}

type TrailerDialogProps = { trailerKey: string; title: string; open: boolean; onClose: () => void };

/** A YouTube trailer in a dialog. The iframe exists only while the dialog is open, so nothing loads or plays before. */
export function TrailerDialog({ trailerKey, title, open, onClose }: TrailerDialogProps) {
  return <Modal open={open} title={`${title} — Trailer`} onClose={onClose} maxWidthClassName="max-w-4xl">
    {open && <div className="aspect-video w-full bg-black">
      <iframe src={trailerEmbedUrl(trailerKey)} title={`${title} trailer`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full border-0" />
    </div>}
  </Modal>;
}
