import { open } from 'fs/promises';
import path from 'path';
import { inflateRawSync } from 'zlib';
import { HwpAnalysisLimits } from '../../config/hwpAnalysis';
import { AttachmentProcessingError } from './attachmentErrors';

const CFB_MAGIC = Buffer.from('d0cf11e0a1b11ae1', 'hex');
const ZIP_MAGICS = [0x04034b50, 0x06054b50, 0x08074b50];
const FREE_SECTOR = 0xffffffff;
const END_OF_CHAIN = 0xfffffffe;

export type ContainerKind = 'OLE' | 'ZIP' | 'OTHER';

export type OleHwpAnalysis = {
  isCfb: boolean;
  directoryEntryCount: number;
  streamCount: number;
  fileHeaderPresent: boolean;
  signatureValid: boolean;
  version: string | null;
  compressed: boolean | null;
  encrypted: boolean | null;
  distribution: boolean | null;
  bodyTextPresent: boolean;
  viewTextPresent: boolean;
  sectionCount: number;
};

export type HwpxAnalysis = {
  isZip: boolean;
  entryCount: number;
  totalUncompressedBytes: number;
  maximumCompressionRatio: number;
  mimetypePresent: boolean;
  mimetypeValid: boolean;
  contentHpfPresent: boolean;
  manifestPresent: boolean;
  sectionCount: number;
  requiredEntriesValid: boolean;
};

export type HwpContainerAnalysis = {
  magicHex: string;
  containerKind: ContainerKind;
  isActualHwp: boolean;
  isActualHwpx: boolean;
  ole: OleHwpAnalysis | null;
  hwpx: HwpxAnalysis | null;
};

function analysisError(code: 'HWP_CONTAINER_INVALID' | 'HWP_LIMIT_EXCEEDED' | 'HWPX_CONTAINER_INVALID' | 'HWPX_LIMIT_EXCEEDED', message: string) {
  return new AttachmentProcessingError(code, message);
}

function safeZipPath(name: string) {
  const normalized = name.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return false;
  return normalized.split('/').every((part) => part !== '..' && part !== '');
}

async function analyzeZip(filePath: string, fileSize: number, limits: HwpAnalysisLimits): Promise<HwpxAnalysis> {
  const handle = await open(filePath, 'r');
  try {
    const tailLength = Math.min(fileSize, 65_557);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tail.length, fileSize - tailLength);
    let eocd = -1;
    for (let index = tail.length - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
    }
    if (eocd < 0) throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP end-of-central-directory record is missing.');
    const entryCount = tail.readUInt16LE(eocd + 10);
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
      throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP64 is not supported by the bounded analyzer.');
    }
    if (entryCount > limits.zipMaxEntries) throw analysisError('HWPX_LIMIT_EXCEEDED', 'ZIP entry count exceeds the analysis limit.');
    if (centralOffset + centralSize > fileSize || centralSize > limits.zipMaxTotalUncompressedBytes) {
      throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP central directory is outside the file bounds.');
    }
    const central = Buffer.alloc(centralSize);
    await handle.read(central, 0, central.length, centralOffset);
    type Entry = { name: string; method: number; flags: number; compressed: number; uncompressed: number; localOffset: number };
    const entries: Entry[] = [];
    let cursor = 0;
    let totalUncompressedBytes = 0;
    let maximumCompressionRatio = 0;
    while (cursor < central.length) {
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== 0x02014b50) {
        throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP central directory entry is invalid.');
      }
      const flags = central.readUInt16LE(cursor + 8);
      const method = central.readUInt16LE(cursor + 10);
      const compressed = central.readUInt32LE(cursor + 20);
      const uncompressed = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28);
      const extraLength = central.readUInt16LE(cursor + 30);
      const commentLength = central.readUInt16LE(cursor + 32);
      const localOffset = central.readUInt32LE(cursor + 42);
      const end = cursor + 46 + nameLength + extraLength + commentLength;
      if (end > central.length) throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP entry metadata is truncated.');
      const name = central.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
      if (!safeZipPath(name)) throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP entry path is unsafe.');
      if ((flags & 1) !== 0) throw analysisError('HWPX_CONTAINER_INVALID', 'Encrypted ZIP entries are not supported.');
      if (uncompressed > limits.zipMaxEntryBytes) throw analysisError('HWPX_LIMIT_EXCEEDED', 'ZIP entry exceeds the size limit.');
      totalUncompressedBytes += uncompressed;
      if (totalUncompressedBytes > limits.zipMaxTotalUncompressedBytes) {
        throw analysisError('HWPX_LIMIT_EXCEEDED', 'ZIP total uncompressed size exceeds the limit.');
      }
      const ratio = uncompressed === 0 ? 0 : uncompressed / Math.max(1, compressed);
      maximumCompressionRatio = Math.max(maximumCompressionRatio, ratio);
      if (ratio > limits.zipMaxCompressionRatio) throw analysisError('HWPX_LIMIT_EXCEEDED', 'ZIP compression ratio is suspicious.');
      entries.push({ name, method, flags, compressed, uncompressed, localOffset });
      cursor = end;
    }
    if (entries.length !== entryCount) throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP entry count does not match its directory.');

    const readSmallEntry = async (entry: Entry) => {
      if (entry.uncompressed > 4_096) throw analysisError('HWPX_CONTAINER_INVALID', 'HWPX mimetype entry is unexpectedly large.');
      const localHeader = Buffer.alloc(30);
      await handle.read(localHeader, 0, localHeader.length, entry.localOffset);
      if (localHeader.readUInt32LE(0) !== 0x04034b50) throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP local header is invalid.');
      const nameLength = localHeader.readUInt16LE(26);
      const extraLength = localHeader.readUInt16LE(28);
      const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
      if (dataOffset + entry.compressed > fileSize) throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP entry data is outside the file bounds.');
      const compressed = Buffer.alloc(entry.compressed);
      await handle.read(compressed, 0, compressed.length, dataOffset);
      if (entry.method === 0) return compressed;
      if (entry.method === 8) return inflateRawSync(compressed, { maxOutputLength: limits.zipMaxEntryBytes });
      throw analysisError('HWPX_CONTAINER_INVALID', 'ZIP compression method is unsupported.');
    };

    const names = new Set(entries.map((entry) => entry.name));
    const mimetypeEntry = entries.find((entry) => entry.name === 'mimetype');
    const mimetype = mimetypeEntry ? (await readSmallEntry(mimetypeEntry)).toString('utf8').trim() : '';
    const sectionCount = entries.filter((entry) => /^Contents\/section\d+\.xml$/i.test(entry.name)).length;
    const result = {
      isZip: true,
      entryCount,
      totalUncompressedBytes,
      maximumCompressionRatio: Number(maximumCompressionRatio.toFixed(2)),
      mimetypePresent: Boolean(mimetypeEntry),
      mimetypeValid: mimetype === 'application/hwp+zip',
      contentHpfPresent: names.has('Contents/content.hpf'),
      manifestPresent: names.has('META-INF/manifest.xml'),
      sectionCount,
      requiredEntriesValid: false,
    };
    result.requiredEntriesValid = result.mimetypeValid && result.contentHpfPresent && result.manifestPresent && sectionCount > 0;
    return result;
  } finally {
    await handle.close();
  }
}

async function analyzeOle(filePath: string, fileSize: number, limits: HwpAnalysisLimits): Promise<OleHwpAnalysis> {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(512);
    await handle.read(header, 0, header.length, 0);
    if (!header.subarray(0, 8).equals(CFB_MAGIC)) throw analysisError('HWP_CONTAINER_INVALID', 'CFB signature is invalid.');
    const sectorShift = header.readUInt16LE(30);
    const miniSectorShift = header.readUInt16LE(32);
    const sectorSize = 2 ** sectorShift;
    const miniSectorSize = 2 ** miniSectorShift;
    if (![512, 4096].includes(sectorSize) || miniSectorSize !== 64) throw analysisError('HWP_CONTAINER_INVALID', 'CFB sector sizes are unsupported.');
    const maxSector = Math.floor((fileSize - 512) / sectorSize);
    const readSector = async (sector: number) => {
      if (!Number.isInteger(sector) || sector < 0 || sector >= maxSector) throw analysisError('HWP_CONTAINER_INVALID', 'CFB sector index is outside the file.');
      const buffer = Buffer.alloc(sectorSize);
      await handle.read(buffer, 0, buffer.length, 512 + sector * sectorSize);
      return buffer;
    };
    const difat: number[] = [];
    for (let offset = 76; offset < 512; offset += 4) {
      const value = header.readUInt32LE(offset);
      if (value !== FREE_SECTOR) difat.push(value);
    }
    const fatSectorCount = header.readUInt32LE(44);
    if (fatSectorCount > limits.oleMaxDirectoryEntries) throw analysisError('HWP_LIMIT_EXCEEDED', 'CFB FAT count exceeds the limit.');
    let nextDifat = header.readUInt32LE(68);
    const difatSectorCount = header.readUInt32LE(72);
    for (let count = 0; count < difatSectorCount; count += 1) {
      const sector = await readSector(nextDifat);
      for (let offset = 0; offset < sectorSize - 4; offset += 4) {
        const value = sector.readUInt32LE(offset);
        if (value !== FREE_SECTOR) difat.push(value);
      }
      nextDifat = sector.readUInt32LE(sectorSize - 4);
    }
    if (difat.length < fatSectorCount) throw analysisError('HWP_CONTAINER_INVALID', 'CFB FAT is truncated.');
    const fat: number[] = [];
    for (const sectorNumber of difat.slice(0, fatSectorCount)) {
      const sector = await readSector(sectorNumber);
      for (let offset = 0; offset < sector.length; offset += 4) fat.push(sector.readUInt32LE(offset));
    }
    const chain = async (start: number, maximumBytes: number) => {
      if (start === END_OF_CHAIN) return Buffer.alloc(0);
      const chunks: Buffer[] = [];
      const visited = new Set<number>();
      let current = start;
      let bytes = 0;
      while (current !== END_OF_CHAIN) {
        if (visited.has(current)) throw analysisError('HWP_CONTAINER_INVALID', 'CFB sector chain contains a cycle.');
        visited.add(current);
        const sector = await readSector(current);
        chunks.push(sector);
        bytes += sector.length;
        if (bytes > maximumBytes) throw analysisError('HWP_LIMIT_EXCEEDED', 'CFB stream exceeds the size limit.');
        current = fat[current];
        if (current === undefined || current === FREE_SECTOR) throw analysisError('HWP_CONTAINER_INVALID', 'CFB sector chain is invalid.');
      }
      return Buffer.concat(chunks);
    };
    const directoryStart = header.readUInt32LE(48);
    const directory = await chain(directoryStart, limits.oleMaxDirectoryEntries * 128);
    type DirectoryEntry = { name: string; type: number; start: number; size: number };
    const entries: DirectoryEntry[] = [];
    for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
      const nameBytes = Math.min(directory.readUInt16LE(offset + 64), 64);
      const type = directory[offset + 66];
      if (type === 0 || nameBytes < 2) continue;
      const name = directory.subarray(offset, offset + nameBytes - 2).toString('utf16le');
      const sizeBig = directory.readBigUInt64LE(offset + 120);
      if (sizeBig > BigInt(Number.MAX_SAFE_INTEGER)) throw analysisError('HWP_LIMIT_EXCEEDED', 'CFB stream size is too large.');
      entries.push({ name, type, start: directory.readUInt32LE(offset + 116), size: Number(sizeBig) });
      if (entries.length > limits.oleMaxDirectoryEntries) throw analysisError('HWP_LIMIT_EXCEEDED', 'CFB directory entry count exceeds the limit.');
    }
    const root = entries.find((entry) => entry.type === 5);
    if (!root) throw analysisError('HWP_CONTAINER_INVALID', 'CFB root storage is missing.');
    const miniCutoff = header.readUInt32LE(56);
    const miniFatStart = header.readUInt32LE(60);
    const miniFatSectorCount = header.readUInt32LE(64);
    const miniFatBuffer = miniFatSectorCount > 0 ? await chain(miniFatStart, miniFatSectorCount * sectorSize) : Buffer.alloc(0);
    const miniFat: number[] = [];
    for (let offset = 0; offset + 4 <= miniFatBuffer.length; offset += 4) miniFat.push(miniFatBuffer.readUInt32LE(offset));
    const miniStream = root.size > 0 ? (await chain(root.start, Math.min(root.size + sectorSize, limits.oleMaxStreamBytes))).subarray(0, root.size) : Buffer.alloc(0);
    const readEntry = async (entry: DirectoryEntry) => {
      if (entry.size > limits.oleMaxStreamBytes) throw analysisError('HWP_LIMIT_EXCEEDED', 'CFB stream exceeds the analysis limit.');
      if (entry.size >= miniCutoff) return (await chain(entry.start, entry.size + sectorSize)).subarray(0, entry.size);
      const chunks: Buffer[] = [];
      const visited = new Set<number>();
      let current = entry.start;
      while (current !== END_OF_CHAIN && Buffer.concat(chunks).length < entry.size) {
        if (visited.has(current) || current >= miniFat.length) throw analysisError('HWP_CONTAINER_INVALID', 'CFB mini stream chain is invalid.');
        visited.add(current);
        const offset = current * miniSectorSize;
        if (offset + miniSectorSize > miniStream.length) throw analysisError('HWP_CONTAINER_INVALID', 'CFB mini stream is truncated.');
        chunks.push(miniStream.subarray(offset, offset + miniSectorSize));
        current = miniFat[current];
      }
      return Buffer.concat(chunks).subarray(0, entry.size);
    };
    const fileHeader = entries.find((entry) => entry.type === 2 && entry.name === 'FileHeader');
    let signatureValid = false;
    let version: string | null = null;
    let compressed: boolean | null = null;
    let encrypted: boolean | null = null;
    let distribution: boolean | null = null;
    if (fileHeader) {
      const value = await readEntry(fileHeader);
      signatureValid = value.subarray(0, 17).toString('ascii') === 'HWP Document File';
      if (value.length >= 40) {
        version = `${value[35]}.${value[34]}.${value[33]}.${value[32]}`;
        const flags = value.readUInt32LE(36);
        compressed = (flags & 1) !== 0;
        encrypted = (flags & 2) !== 0;
        distribution = (flags & 4) !== 0;
      }
    }
    const names = entries.map((entry) => entry.name);
    const bodyTextPresent = names.includes('BodyText');
    const viewTextPresent = names.includes('ViewText');
    const sectionCount = names.filter((name) => /^Section\d+$/i.test(name)).length;
    return {
      isCfb: true,
      directoryEntryCount: entries.length,
      streamCount: entries.filter((entry) => entry.type === 2).length,
      fileHeaderPresent: Boolean(fileHeader),
      signatureValid,
      version,
      compressed,
      encrypted,
      distribution,
      bodyTextPresent,
      viewTextPresent,
      sectionCount,
    };
  } finally {
    await handle.close();
  }
}

export async function analyzeHwpContainer(filePath: string, fileSize: number, limits: HwpAnalysisLimits): Promise<HwpContainerAnalysis> {
  const handle = await open(filePath, 'r');
  const magic = Buffer.alloc(16);
  try { await handle.read(magic, 0, magic.length, 0); }
  finally { await handle.close(); }
  const magicHex = magic.toString('hex');
  if (magic.subarray(0, 8).equals(CFB_MAGIC)) {
    const ole = await analyzeOle(filePath, fileSize, limits);
    return { magicHex, containerKind: 'OLE', isActualHwp: ole.signatureValid, isActualHwpx: false, ole, hwpx: null };
  }
  if (ZIP_MAGICS.includes(magic.readUInt32LE(0))) {
    const hwpx = await analyzeZip(filePath, fileSize, limits);
    return { magicHex, containerKind: 'ZIP', isActualHwp: false, isActualHwpx: hwpx.requiredEntriesValid, ole: null, hwpx };
  }
  return { magicHex, containerKind: 'OTHER', isActualHwp: false, isActualHwpx: false, ole: null, hwpx: null };
}

export function fileNameExtension(fileName: string) {
  return path.extname(fileName).slice(1).toUpperCase() || null;
}
