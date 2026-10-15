import { inflateRawSync } from "node:zlib";

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export class ZipArchiveError extends Error {}

export function readZipEntries(buffer: Buffer): ReadonlyMap<string, Buffer> {
  const end = findEndRecord(buffer);
  const entryCount = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new ZipArchiveError("Invalid ZIP central directory.");
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");
    entries.set(
      name,
      readLocalEntry(buffer, localOffset, compressedSize, method),
    );
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndRecord(buffer: Buffer): number {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let cursor = buffer.length - 22; cursor >= minimum; cursor -= 1) {
    if (buffer.readUInt32LE(cursor) === END_SIGNATURE) return cursor;
  }
  throw new ZipArchiveError("ZIP end record was not found.");
}

function readLocalEntry(
  buffer: Buffer,
  offset: number,
  size: number,
  method: number,
): Buffer {
  if (buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) {
    throw new ZipArchiveError("Invalid ZIP local entry.");
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(start, start + size);
  if (method === 0) return Buffer.from(compressed);
  if (method === 8) return inflateRawSync(compressed);
  throw new ZipArchiveError(`Unsupported ZIP compression method ${method}.`);
}
