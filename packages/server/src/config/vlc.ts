/** Where VLC is looked for, in order. Windows roots are environment variable names; the path is relative to each. */
export const vlcWindowsEnvRoots = ['ProgramFiles', 'ProgramFiles(x86)'] as const;
export const vlcWindowsRelativePath = 'VideoLAN\\VLC\\vlc.exe';
export const vlcMacPath = '/Applications/VLC.app/Contents/MacOS/VLC';
/** Last resort on every platform: ask the OS to resolve `vlc` from PATH. */
export const vlcLookupCommand = { win32: 'where', other: 'which' } as const;
export const vlcExecutableName = 'vlc';
