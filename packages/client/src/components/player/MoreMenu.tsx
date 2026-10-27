import { TrackMenu } from './TrackMenu';
import { MoreGlyph } from './playerIcons';
import { moreMenuItems, type MoreCommand, type MoreMenuInput } from '../../utils/moreMenuItems';

export interface MoreMenuProps extends MoreMenuInput {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommand: (command: MoreCommand) => void;
  buttonClassName: string;
}

/** The player's "More" popover: "Credits start here", "Clear credits mark" and the auto-skip override. */
export function MoreMenu({ open, onOpenChange, onCommand, buttonClassName, ...input }: MoreMenuProps) {
  return <TrackMenu label="More" icon={<MoreGlyph />} items={moreMenuItems(input)} open={open} onOpenChange={onOpenChange} onSelect={(item) => onCommand(item.command)} buttonClassName={buttonClassName} />;
}
