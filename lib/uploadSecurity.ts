export const ALLOWED_UPLOAD_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'docx', 'pptx'] as const;
export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

export function hasValidUploadSignature(buffer: Buffer, extension: string): boolean {
  switch (extension) {
    case 'png': return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'jpg':
    case 'jpeg': return buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    case 'webp': return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    case 'pdf': return buffer.subarray(0, 5).toString() === '%PDF-';
    case 'docx':
    case 'pptx': return buffer.subarray(0, 2).equals(Buffer.from([0x50, 0x4b]));
    default: return false;
  }
}
