export const defaultExtensions = ['mp4', 'mkv', 'avi', 'mov', 'm4v', 'wmv', 'flv', 'webm'];
export const defaultIgnoredPatterns = ['.git', '@eaDir', 'sample', 'samples', 'extra', 'extras'];
export const externalRequestTimeoutMs = 15_000;
export const defaultSettings = {
  tmdbApiKey: '',
  omdbApiKey: '',
  extensions: defaultExtensions,
  ignoredPatterns: defaultIgnoredPatterns,
  excludedFolders: [],
  scheduleEnabled: false,
  scheduleCron: '0 3 * * *'
};

export const mimeTypes: Record<string, string> = {
  mp4: 'video/mp4', mkv: 'video/x-matroska', avi: 'video/x-msvideo', mov: 'video/quicktime',
  m4v: 'video/x-m4v', wmv: 'video/x-ms-wmv', flv: 'video/x-flv', webm: 'video/webm'
};
