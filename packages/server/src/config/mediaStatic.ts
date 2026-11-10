// Folders under the data folder that are served publicly (behind the PIN guard) at /media/<folder>/. Nothing else under the data folder is served.
export const MEDIA_STATIC_FOLDERS = ['posters', 'backdrops', 'logos', 'people'] as const;
export type MediaStaticFolder = (typeof MEDIA_STATIC_FOLDERS)[number];

// Only image files are served from those folders; anything else answers 404.
export const MEDIA_STATIC_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
