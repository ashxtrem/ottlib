/** Who a request acts for: the profile whose lists it reads and writes, and the device it came from ("last device"). */
export interface Viewer { profileId: number; deviceId: string | null }
