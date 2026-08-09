// File "true-typing": identifies a file's real format from its magic
// bytes, independent of whatever extension or MIME type it claims to have.
// This is exactly how antivirus/DLP file inspectors avoid being fooled by
// "invoice.pdf.exe" or a renamed script.
const SIGNATURES = [
  { type: 'pdf', family: 'document', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: 'zip-based', family: 'archive', bytes: [0x50, 0x4b, 0x03, 0x04] }, // also docx/xlsx/pptx
  { type: 'zip-based', family: 'archive', bytes: [0x50, 0x4b, 0x05, 0x06] }, // empty zip
  { type: 'rar', family: 'archive', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { type: 'gzip', family: 'archive', bytes: [0x1f, 0x8b] },
  { type: '7z', family: 'archive', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { type: 'png', family: 'image', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'jpeg', family: 'image', bytes: [0xff, 0xd8, 0xff] },
  { type: 'gif', family: 'image', bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: 'bmp', family: 'image', bytes: [0x42, 0x4d] },
  { type: 'exe', family: 'executable', bytes: [0x4d, 0x5a] }, // MZ (PE/DLL/EXE)
  { type: 'elf', family: 'executable', bytes: [0x7f, 0x45, 0x4c, 0x46] },
];

// Which real families are plausible for a given claimed extension.
const EXPECTED_FAMILY = {
  pdf: ['document'],
  doc: ['document', 'archive'], // legacy vs. OOXML
  docx: ['archive'],
  xls: ['document', 'archive'],
  xlsx: ['archive'],
  ppt: ['document', 'archive'],
  pptx: ['archive'],
  zip: ['archive'],
  rar: ['archive'],
  '7z': ['archive'],
  gz: ['archive'],
  png: ['image'],
  jpg: ['image'],
  jpeg: ['image'],
  gif: ['image'],
  bmp: ['image'],
  txt: ['text'],
  csv: ['text'],
};

function detect(buffer) {
  for (const sig of SIGNATURES) {
    if (buffer.length >= sig.bytes.length && sig.bytes.every((b, i) => buffer[i] === b)) {
      return { type: sig.type, family: sig.family };
    }
  }
  // No known binary signature -- check if it's plausibly plain text.
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  const printable = [...sample].filter((b) => (b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d).length;
  if (sample.length === 0 || printable / sample.length > 0.9) return { type: 'text', family: 'text' };
  return { type: 'unknown', family: 'unknown' };
}

function checkMismatch(filename, buffer) {
  const detected = detect(buffer);
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const expectedFamilies = EXPECTED_FAMILY[ext];
  const mismatch = !!expectedFamilies && !expectedFamilies.includes(detected.family);
  return { claimedExtension: ext, detected, mismatch };
}

module.exports = { detect, checkMismatch, SIGNATURES, EXPECTED_FAMILY };
