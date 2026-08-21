import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const folderPickerScript = [
  'Add-Type -AssemblyName System.Windows.Forms',
  '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
  '$dialog.Description = "Select a folder"',
  'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }'
].join('; ');

export async function pickFolder(): Promise<string | null> {
  if (process.platform !== 'win32') throw new Error('Folder selection is only available on Windows');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', folderPickerScript], { windowsHide: true });
  return stdout.trim() || null;
}
