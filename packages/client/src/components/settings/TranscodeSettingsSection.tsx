import { useQueryClient } from '@tanstack/react-query';
import { useSettings, useSettingsActions } from '../../hooks/useSettings';
import { transcodeEncodersQueryKey, useTranscodeEncoders } from '../../hooks/useTranscodeEncoders';
import { TranscodeSection } from './TranscodeSection';

/** Wires TranscodeSection to the settings and encoder queries; picking an encoder saves it at once. */
export function TranscodeSettingsSection() {
  const settings = useSettings();
  const { update } = useSettingsActions();
  const encoders = useTranscodeEncoders();
  const client = useQueryClient();
  if (!settings.data) return null;
  return <TranscodeSection
    value={settings.data.transcodeEncoder}
    saving={update.isPending}
    status={encoders.data}
    statusError={encoders.error?.message}
    onChange={(transcodeEncoder) => update.mutate({ transcodeEncoder }, { onSuccess: () => { void client.invalidateQueries({ queryKey: transcodeEncodersQueryKey }); } })}
  />;
}
