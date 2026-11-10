import { z } from 'zod';

/** What made a backup: an update check, the daily schedule, the user, or a restore that kept the database it replaced. */
export const backupKindSchema = z.enum(['pre-update', 'daily', 'manual', 'before-restore']);
export type BackupKindName = z.infer<typeof backupKindSchema>;

export const backupSchema = z.object({
  /** File name inside the server's `backups/` folder, e.g. `manual-20261110-040000.sqlite`. */
  name: z.string(),
  kind: backupKindSchema,
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string()
});
export type Backup = z.infer<typeof backupSchema>;

export const backupListSchema = z.array(backupSchema);
export type BackupList = z.infer<typeof backupListSchema>;

/** The answer to a restore request: the swap happens at the next server start. */
export const restoreRequestResultSchema = z.object({ status: z.literal('pending-restart') });
export type RestoreRequestResult = z.infer<typeof restoreRequestResultSchema>;
