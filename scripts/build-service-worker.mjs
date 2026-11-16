import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const output = resolve("dist");

/** Enumerate the actual build, so cached filenames cannot drift from Vite's hashed output.
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function buildFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await buildFiles(path)));
    else if (entry.name !== "sw.js") files.push(path);
  }
  return files;
}

const files = (await buildFiles(output)).sort();
const hash = createHash("sha256");
for (const path of files) hash.update(await readFile(path));
const version = hash.digest("hex").slice(0, 16);
const assets = files.map(
  (path) => `./${relative(output, path).replaceAll("\\", "/")}`,
);
const source = `/* Generated from the built app; never caches personal media. */
const PREFIX = 'corto-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + ${JSON.stringify(version)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('./index.html'))));
    return;
  }
  // Static app assets are invariant; Vite's Vary: Origin header must not prevent a module-script cache hit.
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
});
`;
await writeFile(join(output, "sw.js"), source);
console.log(
  `Offline app cache: ${files.length} bundled assets, version ${version}`,
);
