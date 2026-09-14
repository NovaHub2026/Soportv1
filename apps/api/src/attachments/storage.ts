import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

/**
 * Where attachment bytes live (PH-2.3). The database row decides who may read a file; this port only moves
 * bytes. Local disk serves development; an object-store adapter is a PH-8 decision.
 */
export interface AttachmentStorage {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const ATTACHMENT_STORAGE = Symbol('ATTACHMENT_STORAGE');

function assertSafeKey(key: string): void {
  const normalized = normalize(key);
  if (normalized.startsWith('..') || normalized.includes('\0') || key.startsWith('/')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

export class LocalDiskStorage implements AttachmentStorage {
  constructor(private readonly rootDir: string) {}

  private pathFor(key: string): string {
    assertSafeKey(key);
    return join(this.rootDir, key);
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}

/** Tests only: no disk, no cleanup. */
export class MemoryStorage implements AttachmentStorage {
  private readonly files = new Map<string, Buffer>();

  async put(key: string, bytes: Buffer): Promise<void> {
    assertSafeKey(key);
    this.files.set(key, bytes);
  }

  async get(key: string): Promise<Buffer> {
    const bytes = this.files.get(key);
    if (!bytes) throw new Error(`Missing storage key: ${key}`);
    return bytes;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}
