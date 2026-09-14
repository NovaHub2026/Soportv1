import { sniffAllowedMimeType } from './sniff.js';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
const pdf = Buffer.from('%PDF-1.7\n%âãÏÓ\n');

describe('sniffAllowedMimeType', () => {
  it('recognizes the four allowed formats from their magic bytes', () => {
    expect(sniffAllowedMimeType(png)).toBe('image/png');
    expect(sniffAllowedMimeType(jpeg)).toBe('image/jpeg');
    expect(sniffAllowedMimeType(webp)).toBe('image/webp');
    expect(sniffAllowedMimeType(pdf)).toBe('application/pdf');
  });

  it('rejects anything else regardless of the declared type or name (negative cases)', () => {
    expect(sniffAllowedMimeType(Buffer.from('MZ\x90\x00 executable'))).toBeNull(); // Windows PE
    expect(sniffAllowedMimeType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull(); // scriptable
    expect(sniffAllowedMimeType(Buffer.from('GIF89a'))).toBeNull(); // not in the allowlist
    expect(sniffAllowedMimeType(Buffer.alloc(0))).toBeNull();
  });
});
