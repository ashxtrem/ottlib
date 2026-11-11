/** How OttLib hands a Find search to the Hashlark desktop app: a `hashlark://` link opened on the server PC. */
export const hashlarkScheme = 'hashlark';
/** The Hashlark installer registers its URL handler here; the key existing means the app is installed. */
export const hashlarkRegistryKey = 'HKCR\\hashlark\\shell\\open\\command';
/** Reads the key's default value; exits 0 when the key exists. */
export const hashlarkRegistryProbe = { command: 'reg.exe', args: ['query', hashlarkRegistryKey, '/ve'] } as const;
/**
 * Opens a URL through its registered handler without a shell (`cmd /c start` would treat `&` in the link as a command
 * separator). The link is appended as the last argument.
 */
export const hashlarkLauncher = { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler'] } as const;
/** The search category Hashlark opens on. */
export const hashlarkCategory = 'movies';
/** Longest title put into the link. */
export const hashlarkTitleMaxLength = 200;
export const hashlarkNotInstalledMessage = "Hashlark isn't installed on the server PC.";
