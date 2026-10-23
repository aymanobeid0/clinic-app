import type { Database } from "../../database.js";
// The narrow database function deletes only expired operational artifacts across
// tenants. It cannot return bytes, choose a tenant or delete an unexpired export.
export async function cleanupExpiredExports(
  database: Database,
): Promise<number> {
  const result = await database.pool.query<{ deleted: number }>(
    "SELECT public.cleanup_expired_exports() AS deleted",
  );
  return result.rows[0]?.deleted ?? 0;
}
