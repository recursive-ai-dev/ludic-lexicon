import { Reading, AppConfig } from '../types';

export class LexiconDB {
  private dbName = 'LexiconDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('readings')) {
          db.createObjectStore('readings', { keyPath: 'castNumber' });
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'id' });
        }
      };
    });
  }

  async saveReading(reading: Reading): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
        const tx = this.db!.transaction('readings', 'readwrite');
        const store = tx.objectStore('readings');
        const request = store.put(reading);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
  }

  async getHistory(): Promise<Reading[]> {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('readings', 'readonly');
      const store = tx.objectStore('readings');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveConfig(config: AppConfig): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
        const tx = this.db!.transaction('config', 'readwrite');
        const store = tx.objectStore('config');
        const configToSave = {
            ...config,
            id: 'current',
            blacklist: Array.from(config.blacklist)
        };
        const request = store.put(configToSave);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
  }

  async getConfig(): Promise<AppConfig | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('config', 'readonly');
      const store = tx.objectStore('config');
      const request = store.get('current');
      request.onsuccess = () => {
        if (request.result) {
          const cfg = request.result;
          cfg.blacklist = new Set(cfg.blacklist);
          delete cfg.id;
          resolve(cfg as AppConfig);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}
