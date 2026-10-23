import { crc32 } from "node:zlib";

// Each row keeps its relationship path; structured cells remain JSON rather than
// silently dropping nested versions, money, or links from the tabular export.
export function csv(value: unknown): Buffer {
  const rows: string[][] = [["path", "value"]];
  function walk(v: unknown, path: string) {
    if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${path}[${i}]`));
    else if (v !== null && typeof v === "object")
      for (const [key, item] of Object.entries(v))
        walk(item, path ? `${path}.${key}` : key);
    else rows.push([path, v === null ? "" : String(v)]);
  }
  walk(value, "");
  const cell = (v: string) =>
    `"${(/^[\s]*[=+\-@\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""')}"`;
  return Buffer.from(
    "\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n",
  );
}

// Bounded, uncompressed ZIP32: opaque generated entry names, UTF-8 flag, CRC32,
// central directory and no executable metadata. The service caps total bytes.
export function zip(entries: { name: string; bytes: Buffer }[]): Buffer {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      size = entry.bytes.length,
      crc = crc32(entry.bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(size, 18);
    header.writeUInt32LE(size, 22);
    header.writeUInt16LE(name.length, 26);
    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50, 0);
    index.writeUInt16LE(20, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(0x800, 8);
    index.writeUInt16LE(33, 14);
    index.writeUInt32LE(crc, 16);
    index.writeUInt32LE(size, 20);
    index.writeUInt32LE(size, 24);
    index.writeUInt16LE(name.length, 28);
    index.writeUInt32LE(offset, 42);
    local.push(header, name, entry.bytes);
    central.push(index, name);
    offset += header.length + name.length + size;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
