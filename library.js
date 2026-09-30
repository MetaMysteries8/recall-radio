let database;
async function db() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("recall-radio", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("songs", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  return database;
}
async function transact(mode, operation) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("songs", mode);
    const request = operation(transaction.objectStore("songs"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
export const listSongs = () => transact("readonly", (store) => store.getAll());
export const putSong = (song) =>
  transact("readwrite", (store) => store.put(song));
export const deleteSong = (id) =>
  transact("readwrite", (store) => store.delete(id));
