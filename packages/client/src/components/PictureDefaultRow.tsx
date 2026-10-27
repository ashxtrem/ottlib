import { usePictureDefault } from '../hooks/usePictureMode';
import { PICTURE_MODES, isPictureModeId, type PictureModeId } from '../utils/pictureModes';

interface PictureDefaultViewProps {
  value: PictureModeId;
  onChange: (mode: PictureModeId) => void;
}

/** Presentational row: the picture mode titles start with on this device. */
export function PictureDefaultView({ value, onChange }: PictureDefaultViewProps) {
  return <div className="flex flex-wrap items-center justify-between gap-3 py-3">
    <label htmlFor="picture-default" className="min-w-0 flex-1">
      <span className="block text-sm font-medium">Default picture mode</span>
      <span className="mt-0.5 block text-xs text-muted">For titles you haven't changed, on this device only. Change one title from the player's Picture menu.</span>
    </label>
    <select id="picture-default" value={value} onChange={(event) => { if (isPictureModeId(event.target.value)) onChange(event.target.value); }} className="rounded-lg border border-border bg-field px-3 py-2 text-sm">
      {PICTURE_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
    </select>
  </div>;
}

/** Settings → Player: this device's default picture mode. */
export function PictureDefaultRow() {
  const { defaultMode, setDefaultMode } = usePictureDefault();
  return <PictureDefaultView value={defaultMode} onChange={setDefaultMode} />;
}
