// Opslag. Twee standen, de tool kiest zelf:
//  - server: online met api/ ernaast. Posts en foto's staan als bestanden op de server (flat file).
//  - lokaal: los HTML-bestand. Posts staan in deze browser (IndexedDB).
// In beide standen kun je alles bewaren als bestand en weer openen.
import { B, type PostDoc } from "./model";

declare const __BRAND_ID__: string;
const BRAND = typeof __BRAND_ID__ === "string" ? __BRAND_ID__ : B.short.toLowerCase();

export const storage = { mode: "local" as "local" | "server", loggedIn: false, persistent: true, problem: "", open: false };

// ---------- Server ----------
// De API staat naast de tool (contenttool/api/) of één map hoger (contenttool/vinchem/ -> contenttool/api/).
let apiBase = "api/";
const api = (action: string, extra = "") => new URL(`${apiBase}?action=${action}&brand=${encodeURIComponent(BRAND)}${extra}`, location.href).toString();

async function call<T>(action: string, body?: unknown): Promise<T> {
  const res = await fetch(api(action), {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) storage.loggedIn = false;
  if (!res.ok) throw new Error(json.error ?? `Serverfout (${res.status})`);
  return json as T;
}

/** Kijkt of er een server naast de pagina staat. Eén keer bij het opstarten. */
export async function initStorage() {
  if (!location.protocol.startsWith("http")) return;
  try {
    let s: { server?: boolean; setup?: boolean; open?: boolean; error?: string; brand?: string; loggedIn?: boolean } | null = null;
    for (const base of ["api/", "../api/"]) {
      apiBase = base;
      const res = await fetch(api("status"), { credentials: "same-origin" }).catch(() => null);
      s = res ? await res.json().catch(() => null) : null;
      if (s?.server) break;
    }
    if (!s?.server) return;
    // Er staat een server naast de pagina: dan altijd daar opslaan, nooit stilletjes in de browser.
    storage.mode = "server";
    storage.loggedIn = !!s.loggedIn;
    storage.open = !!s.open;
    if (s.setup) storage.problem = s.error ?? "De server is nog niet ingesteld.";
    else if (s.brand !== BRAND) storage.problem = `Het merk "${BRAND}" staat nog niet in api/config.php.`;
  } catch {
    /* geen server: lokaal */
  }
}

export async function login(code: string) {
  await call("login", { code });
  storage.loggedIn = true;
}

export async function logout() {
  await call("logout", {});
  storage.loggedIn = false;
}

// ---------- Lokaal (IndexedDB) ----------
const DB = `merkstudio-${BRAND}`;
const STORE = "posts";
let dbp: Promise<IDBDatabase> | null = null;
const memory = new Map<string, PostDoc>(); // terugval als IndexedDB niet mag (privévenster)

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

// ---------- Publiek ----------
/** Slaat op en geeft de opgeslagen versie terug (op de server wordt een foto-upload een link). */
export async function savePost(d: PostDoc): Promise<PostDoc> {
  d.updated = new Date().toISOString();
  if (storage.mode === "server") return (await call<{ post: PostDoc }>("save", d)).post;
  try {
    await tx("readwrite", (s) => s.put(structuredClone(d)));
  } catch {
    storage.persistent = false;
    memory.set(d.id, structuredClone(d));
  }
  return d;
}

export async function listPosts(): Promise<PostDoc[]> {
  if (storage.mode === "server") return storage.loggedIn ? (await call<{ posts: PostDoc[] }>("list")).posts : [];
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
  if (storage.mode === "server") return void (await call("delete", { id }));
  memory.delete(id);
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* alleen geheugen */
  }
}

// ---------- Bestand ----------
type FileShape = { app: "merkstudio"; brand: string; exported: string; posts: PostDoc[] };

/** Foto-links (server) omzetten naar ingebedde data, zodat het bestand overal werkt. */
async function toData(src: string) {
  if (src.startsWith("data:")) return src;
  const blob = await (await fetch(new URL(src, location.href), { credentials: "same-origin" })).blob();
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

async function inline(p: PostDoc): Promise<PostDoc> {
  const out = { ...p };
  if (p.photo) out.photo = { ...p.photo, src: await toData(p.photo.src) };
  if (p.photo2) out.photo2 = { ...p.photo2, src: await toData(p.photo2.src) };
  return out;
}

export async function downloadFile(posts: PostDoc[], name = `${BRAND}-posts`) {
  const data: FileShape = { app: "merkstudio", brand: BRAND, exported: new Date().toISOString(), posts: await Promise.all(posts.map(inline)) };
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
  if (json?.brand && json.brand !== BRAND) throw new Error(`Dit bestand hoort bij een ander merk (${json.brand}).`);
  let n = 0;
  for (const p of posts) {
    if (!p.id || !p.fields) continue;
    if (p.photo && !p.photo.src.startsWith("data:")) p.photo = null; // losse link werkt niet buiten de oorspronkelijke plek
    if (p.photo2 && !p.photo2.src.startsWith("data:")) p.photo2 = null;
    await savePost(p);
    n++;
  }
  return n;
}

// ---------- Fotobank (alleen online, gedeeld door iedereen van het merk) ----------
export type BankPhoto = { id: string; name: string; added: string; src: string };

export const bankAvailable = () => storage.mode === "server" && storage.loggedIn && !storage.problem;

export async function bankList(): Promise<BankPhoto[]> {
  if (!bankAvailable()) return [];
  return (await call<{ photos: BankPhoto[] }>("bank-list")).photos;
}

export async function bankUpload(src: string, name: string): Promise<BankPhoto> {
  return (await call<{ photo: BankPhoto }>("bank-upload", { src, name })).photo;
}

export async function bankDelete(id: string) {
  await call("bank-delete", { id });
}

// ---------- Buffer (alleen online, sleutel staat op de server) ----------
export type BufferChannel = { id: string; name: string; displayName?: string; service: "instagram" | "facebook"; type: string };
export type BufferTarget = { channelId: string; service: string; kind: "post" | "story"; format: string; notification?: boolean };
export type BufferResult = { ok: boolean; channelId?: string; kind?: string; postId?: string; error?: string };

export async function bufferChannels(): Promise<{ configured: boolean; channels: BufferChannel[] }> {
  if (!bankAvailable()) return { configured: false, channels: [] };
  return call("buffer-channels");
}

export async function bufferSend(caption: string, images: Record<string, string>, targets: BufferTarget[]): Promise<BufferResult[]> {
  return (await call<{ results: BufferResult[] }>("buffer-send", { caption, images, targets })).results;
}
