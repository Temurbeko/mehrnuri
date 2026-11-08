/**
 * Minimal, zero-dependency ISO/IEC 18004 QR Code matrix generator (Byte mode, ECC Level L).
 * Supports URLs up to 134 bytes (Versions 1..6), perfect for merchant deep-links on PC checkout.
 */

interface VersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignment: number[];
}

const VERSIONS: VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignment: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignment: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignment: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignment: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewords: 26, alignment: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, ecCodewords: 18, alignment: [6, 34] }, // 2 blocks of 68 data + 18 ec
];

// GF(256) exp/log tables with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]!;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i]!;
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] ?? 0) ^ poly[j]!;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j]!, factor);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i]! ^ rem[0]!;
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    for (let j = 0; j < ecLen; j++) {
      rem[j] = (rem[j] ?? 0) ^ gfMul(gen[j + 1]!, factor);
    }
  }
  return rem;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec =
    VERSIONS.find((v) => v.dataCodewords - 2 >= bytes.length) ?? VERSIONS[VERSIONS.length - 1]!;
  const maxLen = spec.dataCodewords - 2;
  const payload = bytes.length > maxLen ? bytes.slice(0, maxLen) : bytes;

  // Build bit stream: Byte mode (0100), 8-bit length, payload, terminator, pad bytes
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (const b of payload) pushBits(b, 8);
  pushBits(0, Math.min(4, spec.dataCodewords * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataWords = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b]!;
    dataWords[i] = byte;
  }
  const pads = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < spec.dataCodewords; i++, p++) {
    dataWords[i] = pads[p % 2]!;
  }

  // Error correction & interleaving (Version 1-5 have 1 block at Level L; Version 6 has 2 blocks)
  let finalWords: Uint8Array;
  if (spec.version < 6) {
    const ec = rsEncode(dataWords, spec.ecCodewords);
    finalWords = new Uint8Array(dataWords.length + ec.length);
    finalWords.set(dataWords, 0);
    finalWords.set(ec, dataWords.length);
  } else {
    const half = spec.dataCodewords / 2;
    const b1 = dataWords.slice(0, half);
    const b2 = dataWords.slice(half);
    const ec1 = rsEncode(b1, spec.ecCodewords);
    const ec2 = rsEncode(b2, spec.ecCodewords);
    finalWords = new Uint8Array(spec.dataCodewords + spec.ecCodewords * 2);
    let idx = 0;
    for (let i = 0; i < half; i++) {
      finalWords[idx++] = b1[i]!;
      finalWords[idx++] = b2[i]!;
    }
    for (let i = 0; i < spec.ecCodewords; i++) {
      finalWords[idx++] = ec1[i]!;
      finalWords[idx++] = ec2[i]!;
    }
  }

  const size = spec.size;
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setModule = (r: number, c: number, val: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r]![c] = val;
      reserved[r]![c] = true;
    }
  };

  // Finder patterns + separators
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(row + r, col + c, inOuter && (onBorder || inInner));
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  const align = spec.alignment;
  for (const r of align) {
    for (const c of align) {
      if ((r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const val = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(r + dr, c + dc, val);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6]![i]) setModule(6, i, i % 2 === 0);
    if (!reserved[i]![6]) setModule(i, 6, i % 2 === 0);
  }

  // Dark module & reserve format areas
  setModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8]![i]) reserved[8]![i] = true;
    if (!reserved[i]![8]) reserved[i]![8] = true;
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8]![size - 1 - i]) reserved[8]![size - 1 - i] = true;
    if (!reserved[size - 1 - i]![8]) reserved[size - 1 - i]![8] = true;
  }

  // Place data bits (upward/downward 2-column zigzag)
  let bitIdx = 0;
  const totalBits = finalWords.length * 8;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const r = upward ? size - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!reserved[r]![c]) {
          const bit =
            bitIdx < totalBits
              ? ((finalWords[bitIdx >> 3]! >> (7 - (bitIdx & 7))) & 1) === 1
              : false;
          bitIdx++;
          // Mask pattern 0: (r + c) % 2 === 0
          modules[r]![c] = (r + c) % 2 === 0 ? !bit : bit;
        }
      }
    }
    upward = !upward;
  }

  // Format information for Level L (01) + Mask 0 (000) => precomputed BCH format bits 0x77c4
  const formatBits = 0x77c4;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    // Around top-left
    if (i < 6) modules[i]![8] = bit;
    else if (i < 8) modules[i + 1]![8] = bit;
    else if (i === 8) modules[8]![7] = bit;
    else modules[8]![14 - i] = bit;

    // Split across bottom-left and top-right
    if (i < 8) modules[8]![size - 1 - i] = bit;
    else modules[size - 15 + i]![8] = bit;
  }

  return modules;
}
