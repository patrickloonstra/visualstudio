// Opslag: posts blijven bewaard in de browser (IndexedDB) en zijn te bewaren/openen als bestand.
import { B, type PostDoc } from "./model";

const DB = `merkstudio-${B.short.toLowerCase()}`;
const STORE = "posts";
let dbp: Promise<IDBDatabase> | null = null;
let memory = new Map<string, PostDoc>(); // terugval als IndexedDB niet mag (privévenster)

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const storage = { persistent: true };

export async function savePost(d: PostDoc) {
  d.updated = new Date().toISOString();
  try {
    await tx("readwrite", (s) => s.put(structuredClone(d)));
  } catch {
    storage.persistent = false;
    memory.set(d.id, structuredClone(d));
  }
}

export async function listPosts(): Promise<PostDoc[]> {
  let all: PostDoc[];
  try {
    all = await tx("readonly", (s) => s.getAll() as IDBRequest<PostDoc[]>);
  } catch {
    storage.persistent = false;
    all = [...memory.values()];
  }
  return all.sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function deletePost(id: string) {
  memory.delete(id);
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* alleen geheugen */
  }
}

// ---------- Bestand ----------
type FileShape = { app: "merkstudio"; brand: string; exported: string; posts: PostDoc[] };

export function downloadFile(posts: PostDoc[], name = `${B.short.toLowerCase()}-posts`) {
  const data: FileShape = { app: "merkstudio", brand: B.short.toLowerCase(), exported: new Date().toISOString(), posts };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  a.download = `${name}.merkstudio.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Leest een .merkstudio.json (of één losse post.json) en slaat de posts op. Geeft het aantal terug. */
export async function importFile(file: File): Promise<number> {
  const json = JSON.parse(await file.text());
  const posts: PostDoc[] = Array.isArray(json?.posts) ? json.posts : json?.fields ? [json] : [];
  if (json?.brand && json.brand !== B.short.toLowerCase()) throw new Error(`Dit bestand hoort bij een ander merk (${json.brand}).`);
  for (const p of posts) {
    if (!p.id || !p.fields) continue;
    if (p.photo && !p.photo.src.startsWith("data:")) p.photo = null; // los pad werkt niet in de browser
    await savePost(p);
  }
  return posts.length;
}

export function resetMemory() {
  memory = new Map();
}
