import type { StorageAdapter } from './storage';

export interface Entity {
  id: string;
}

let idCounter = 0;

/** ID único legível (mock local; um backend real substituirá por UUID do servidor). */
export function newId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/**
 * Repositório genérico persistido em StorageAdapter, com seed inicial.
 * CRUD completo sobre dados mockados; a interface é assíncrona para que a
 * troca por uma API real não mude os call sites.
 */
export class Repository<T extends Entity> {
  private cache: T[] | null = null;

  constructor(
    private readonly key: string,
    private readonly seed: T[],
    private readonly storage: StorageAdapter,
    private readonly idPrefix = 'id',
  ) {}

  async list(): Promise<T[]> {
    if (this.cache) return [...this.cache];
    const raw = await this.storage.getItem(this.key);
    if (raw) {
      try {
        this.cache = JSON.parse(raw) as T[];
        return [...this.cache];
      } catch {
        // dado corrompido: volta ao seed
      }
    }
    this.cache = [...this.seed];
    await this.persist();
    return [...this.cache];
  }

  async get(id: string): Promise<T | undefined> {
    const items = await this.list();
    return items.find((item) => item.id === id);
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const items = await this.list();
    const created = { ...data, id: newId(this.idPrefix) } as T;
    this.cache = [created, ...items];
    await this.persist();
    return created;
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | undefined> {
    const items = await this.list();
    let updated: T | undefined;
    this.cache = items.map((item) => {
      if (item.id !== id) return item;
      updated = { ...item, ...patch, id };
      return updated;
    });
    await this.persist();
    return updated;
  }

  async remove(id: string): Promise<void> {
    const items = await this.list();
    this.cache = items.filter((item) => item.id !== id);
    await this.persist();
  }

  async replaceAll(items: T[]): Promise<void> {
    this.cache = [...items];
    await this.persist();
  }

  /** Apaga os dados salvos e volta ao seed inicial. */
  async reset(): Promise<void> {
    this.cache = [...this.seed];
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(this.cache ?? []));
  }
}
