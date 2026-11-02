export function blobRef(id: string): string {
  return `blob:${id}`;
}

export function parseBlobRef(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('blob:')) return null;
  const id = value.slice('blob:'.length);
  return id.length > 0 ? id : null;
}

export function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

export function parseDataUrl(value: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const binary = atob(match[2].replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mimeType, bytes };
}

export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
