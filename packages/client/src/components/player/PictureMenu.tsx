import { TrackMenu } from './TrackMenu';
import { PictureGlyph } from './playerIcons';
import { pictureMenuItems, type PictureModeId } from '../../utils/pictureModes';

export interface PictureMenuProps {
  mode: PictureModeId;
  onSelect: (mode: PictureModeId) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buttonClassName: string;
}

/** The player's "Picture" popover: the 7 picture modes (remembered for this title on this device). */
export function PictureMenu({ mode, onSelect, open, onOpenChange, buttonClassName }: PictureMenuProps) {
  return <TrackMenu label="Picture" icon={<PictureGlyph />} items={pictureMenuItems(mode)} open={open} onOpenChange={onOpenChange} onSelect={(item) => onSelect(item.mode)} buttonClassName={buttonClassName} />;
}
