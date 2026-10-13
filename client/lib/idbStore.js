const DB_VERSION = 1;
const STORE_NAME = 'operations';

function openDatabase(userId) {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(`smart-routine-outbox-${userId}`, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'opId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the offline sync store.'));
    request.onblocked = () => reject(new Error('The offline sync store is blocked by another open tab.'));
  });
}

function runTransaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    try {
      result = action(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result?.result);
    transaction.onerror = () => reject(transaction.error || new Error('Could not update the offline sync store.'));
    transaction.onabort = () => reject(transaction.error || new Error('The offline sync store transaction was aborted.'));
  });
}

export function createIndexedDbStore(userId) {
  if (typeof globalThis.indexedDB === 'undefined') {
    throw new Error('Offline sync requires a browser with IndexedDB support.');
  }

  let databasePromise;
  const database = () => {
    databasePromise ??= openDatabase(userId);
    return databasePromise;
  };

  return {
    async list() {
      const db = await database();
      const items = await runTransaction(db, 'readonly', (store) => store.getAll());
      return (items || []).sort((a, b) => a.queuedAt - b.queuedAt);
    },
    async put(operation) {
      const db = await database();
      await runTransaction(db, 'readwrite', (store) => store.put(operation));
    },
    async remove(opId) {
      const db = await database();
      await runTransaction(db, 'readwrite', (store) => store.delete(opId));
    },
  };
}
