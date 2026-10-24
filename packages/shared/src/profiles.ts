/** Avatar colors a profile can pick; the first one belongs to the default owner profile. */
export const profileColors = ['#e50914', '#f5a524', '#17c964', '#006fee', '#7828c8', '#f31260'] as const;

export const MAX_PROFILES = 6;

/** How a title was handed off to a player, recorded in playback history. */
export const playMethods = ['android_app', 'm3u', 'intent', 'local_launch'] as const;

export type ProfileColor = (typeof profileColors)[number];
export type PlayMethod = (typeof playMethods)[number];
