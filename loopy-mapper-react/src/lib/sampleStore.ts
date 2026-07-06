// ═══════════════════════════════════════════════════════════════════
// SAMPLE STORE — Persist user-uploaded drum samples in IndexedDB.
// Samples are stored as data-URLs (self-contained), so they survive a
// reload AND remain valid when saved into a song's sound source — unlike
// blob: object URLs, which die with the page session.
// ═══════════════════════════════════════════════════════════════════

const DB_NAME = 'looper-samples';
const STORE = 'uploads';
const VERSION = 1;

export interface StoredSample {
    id: string;
    filename: string;
    dataUrl: string;
    addedAt: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return openDB().then(db => new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
    }));
}

/** UUID that also works in non-secure contexts (iPad over http on a LAN),
 *  where crypto.randomUUID is unavailable. */
function uuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try { return crypto.randomUUID(); } catch { /* fall through */ }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.floor(Math.random() * 16);
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
    });
}

/** Store uploaded audio files; returns the stored records. Non-audio files are skipped. */
export async function addUploadedSamples(files: File[] | FileList): Promise<StoredSample[]> {
    const list = Array.from(files).filter(f => /\.(wav|aiff?|mp3|ogg|flac)$/i.test(f.name) || f.type.startsWith('audio/'));
    const stored: StoredSample[] = [];
    for (const file of list) {
        const rec: StoredSample = {
            id: uuid(),
            filename: file.name,
            dataUrl: await readAsDataUrl(file),
            addedAt: Date.now(),
        };
        await tx('readwrite', s => s.put(rec));
        stored.push(rec);
    }
    return stored;
}

export async function getUploadedSamples(): Promise<StoredSample[]> {
    try {
        const all = await tx<StoredSample[]>('readonly', s => s.getAll());
        return all.sort((a, b) => a.addedAt - b.addedAt);
    } catch {
        return [];
    }
}

export async function deleteUploadedSample(id: string): Promise<void> {
    await tx('readwrite', s => s.delete(id));
}

export async function clearUploadedSamples(): Promise<void> {
    await tx('readwrite', s => s.clear());
}
