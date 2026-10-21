import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
export interface PrivateFileStore {
  put(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  discard(key: string): Promise<void>;
}
export function privateFileStore(directory: string): PrivateFileStore {
  const root = resolve(directory);
  const path = (key: string) => {
    if (!/^[a-f0-9-]{36}$/.test(key))
      throw new Error("Invalid private storage key.");
    return join(root, key);
  };
  return {
    async put(key, bytes) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const file = await open(path(key), "wx", 0o600);
      try {
        await file.writeFile(bytes);
        await file.sync();
      } finally {
        await file.close();
      }
    },
    read(key) {
      return readFile(path(key));
    },
    async discard(key) {
      try {
        await unlink(path(key));
      } catch (e) {
        if (!(e && typeof e === "object" && "code" in e && e.code === "ENOENT"))
          throw e;
      }
    },
  };
}
