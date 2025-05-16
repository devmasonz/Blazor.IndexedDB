/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./client/indexedDbBlazor.ts":
/*!***********************************!*\
  !*** ./client/indexedDbBlazor.ts ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.IndexedDbManager = void 0;
const idb_1 = __webpack_require__(/*! idb */ "./node_modules/idb/build/index.js");
class IndexedDbManager {
    constructor() {
        this.dbInstance = null;
        this.dbName = '';
        this.dotnetCallback = (message) => { };
        this.openDb = (data, instanceWrapper) => __awaiter(this, void 0, void 0, function* () {
            const dbStore = data;
            this.dotnetCallback = (message) => {
                instanceWrapper.instance.invokeMethodAsync(instanceWrapper.methodName, message);
            };
            try {
                this.dbName = dbStore.dbName;
                if (this.dbInstance) {
                    if (this.dbInstance.name !== dbStore.dbName || this.dbInstance.version < dbStore.version) {
                        this.dbInstance.close();
                        this.dbInstance = null;
                    }
                }
                if (!this.dbInstance) {
                    this.dbInstance = yield (0, idb_1.openDB)(dbStore.dbName, dbStore.version, {
                        upgrade: (db, oldVersion, newVersion, transaction) => {
                            this.upgradeDatabase(db, oldVersion, dbStore);
                        }
                    });
                }
            }
            catch (e) {
                this.dbInstance = yield (0, idb_1.openDB)(dbStore.dbName);
            }
            return `IndexedDB ${data.dbName} opened`;
        });
        this.getDbInfo = (dbName, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            if (this.dbName !== dbName) {
                if (this.dbInstance) {
                    this.dbInstance.close();
                }
                this.dbInstance = yield (0, idb_1.openDB)(dbName);
                this.dbName = dbName;
            }
            if (!this.dbInstance) {
                throw new Error("Database instance not initialized");
            }
            let getStoreNames = (list) => {
                let names = [];
                for (var i = 0; i < list.length; i++) {
                    names.push(list[i]);
                }
                return names;
            };
            const dbInfo = {
                version: this.dbInstance.version,
                storeNames: getStoreNames(this.dbInstance.objectStoreNames)
            };
            return dbInfo;
        });
        this.deleteDb = (dbName) => __awaiter(this, void 0, void 0, function* () {
            if (this.dbInstance && this.dbInstance.name === dbName) {
                this.dbInstance.close();
                this.dbInstance = null;
                this.dbName = '';
            }
            yield (0, idb_1.deleteDB)(dbName);
            return `The database ${dbName} has been deleted`;
        });
        this.addRecord = (record, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const stName = record.storeName;
            let itemToSave = record.data;
            const tx = this.dbInstance.transaction(stName, 'readwrite');
            const objectStore = tx.objectStore(stName);
            itemToSave = this.checkForKeyPath(objectStore, itemToSave);
            const result = record.key ?
                yield objectStore.add(itemToSave, record.key) :
                yield objectStore.add(itemToSave);
            yield tx.done;
            return `Added new record with id ${result}`;
        });
        this.updateRecord = (record, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const stName = record.storeName;
            const tx = this.dbInstance.transaction(stName, 'readwrite');
            const result = record.key ?
                yield tx.objectStore(stName).put(record.data, record.key) :
                yield tx.objectStore(stName).put(record.data);
            yield tx.done;
            return `updated record with id ${result}`;
        });
        this.getRecords = (storeName, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const tx = this.dbInstance.transaction(storeName, 'readonly');
            const results = yield tx.objectStore(storeName).getAll();
            yield tx.done;
            return results;
        });
        this.clearStore = (storeName, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const tx = this.dbInstance.transaction(storeName, 'readwrite');
            yield tx.objectStore(storeName).clear();
            yield tx.done;
            return `Store ${storeName} cleared`;
        });
        this.getRecordByIndex = (searchData, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const tx = this.dbInstance.transaction(searchData.storeName, 'readonly');
            const results = yield tx.objectStore(searchData.storeName)
                .index(searchData.indexName)
                .get(searchData.queryValue);
            yield tx.done;
            return results;
        });
        this.getAllRecordsByIndex = (searchData, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const tx = this.dbInstance.transaction(searchData.storeName, 'readonly');
            const index = tx.objectStore(searchData.storeName).index(searchData.indexName);
            let results = [];
            let cursor = yield index.openCursor();
            while (cursor) {
                if (cursor.key === searchData.queryValue) {
                    results.push(cursor.value);
                }
                cursor = yield cursor.continue();
            }
            yield tx.done;
            return results;
        });
        this.getRecordById = (storeName, id, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const tx = this.dbInstance.transaction(storeName, 'readonly');
            let result = yield tx.objectStore(storeName).get(id);
            yield tx.done;
            return result;
        });
        this.deleteRecord = (storeName, id, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const tx = this.dbInstance.transaction(storeName, 'readwrite');
            yield tx.objectStore(storeName).delete(id);
            yield tx.done;
            return `Record with id: ${id} deleted`;
        });
        this.getAllDatabaseNames = () => __awaiter(this, void 0, void 0, function* () {
            if ('databases' in indexedDB) {
                try {
                    const databases = yield indexedDB.databases();
                    return databases.map(db => db.name).filter(name => name !== null);
                }
                catch (e) {
                    console.error('Error getting database names:', e);
                    return [];
                }
            }
            else {
                return this.dbName ? [this.dbName] : [];
            }
        });
        this.renameStore = (oldName, newName, dotNetRef) => __awaiter(this, void 0, void 0, function* () {
            this.ensureDbIsOpen();
            const tx = this.dbInstance.transaction(oldName, 'readwrite');
            const oldStore = tx.objectStore(oldName);
            const allData = yield oldStore.getAll();
            yield tx.done;
            const newVersion = this.dbInstance.version + 1;
            yield this.dbInstance.close();
            const upgradedDb = yield (0, idb_1.openDB)(this.dbName, newVersion, {
                upgrade(database, oldVersion, newVersion, transaction) {
                    const oldStoreConfig = database.objectStoreNames.contains(oldName) ?
                        transaction.objectStore(oldName) : null;
                    if (oldStoreConfig) {
                        const newStore = database.createObjectStore(newName, {
                            keyPath: oldStoreConfig.keyPath,
                            autoIncrement: oldStoreConfig.autoIncrement
                        });
                        for (const indexName of oldStoreConfig.indexNames) {
                            const index = oldStoreConfig.index(indexName);
                            newStore.createIndex(indexName, index.keyPath, {
                                unique: index.unique,
                                multiEntry: index.multiEntry
                            });
                        }
                        database.deleteObjectStore(oldName);
                    }
                }
            });
            if (allData.length > 0) {
                const newTx = upgradedDb.transaction(newName, 'readwrite');
                const newStore = newTx.objectStore(newName);
                for (const item of allData) {
                    yield newStore.add(item);
                }
                yield newTx.done;
            }
            this.dbInstance = upgradedDb;
            return `Store ${oldName} renamed to ${newName}`;
        });
    }
    ensureDbIsOpen() {
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized. Call openDb first.");
        }
    }
    checkForKeyPath(objectStore, data) {
        if (!objectStore.autoIncrement || !objectStore.keyPath) {
            return data;
        }
        if (typeof objectStore.keyPath !== 'string') {
            return data;
        }
        const keyPath = objectStore.keyPath;
        if (!data[keyPath]) {
            delete data[keyPath];
        }
        return data;
    }
    upgradeDatabase(db, oldVersion, dbStore) {
        if (oldVersion < dbStore.version) {
            if (dbStore.stores) {
                for (var store of dbStore.stores) {
                    if (!db.objectStoreNames.contains(store.name)) {
                        this.addNewStore(db, store);
                        this.dotnetCallback(`store added ${store.name}: db version: ${dbStore.version}`);
                    }
                }
            }
        }
    }
    addNewStore(db, store) {
        let primaryKey = store.primaryKey;
        if (!primaryKey) {
            primaryKey = { name: 'id', keyPath: 'id', auto: true };
        }
        const newStore = db.createObjectStore(store.name, { keyPath: primaryKey.keyPath, autoIncrement: primaryKey.auto });
        for (var index of store.indexes) {
            newStore.createIndex(index.name, index.keyPath, { unique: index.unique });
        }
    }
}
exports.IndexedDbManager = IndexedDbManager;


/***/ }),

/***/ "./node_modules/idb/build/index.js":
/*!*****************************************!*\
  !*** ./node_modules/idb/build/index.js ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   deleteDB: () => (/* binding */ deleteDB),
/* harmony export */   openDB: () => (/* binding */ openDB),
/* harmony export */   unwrap: () => (/* binding */ unwrap),
/* harmony export */   wrap: () => (/* binding */ wrap)
/* harmony export */ });
const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

let idbProxyableTypes;
let cursorAdvanceMethods;
// This is a function to prevent it throwing up in node environments.
function getIdbProxyableTypes() {
    return (idbProxyableTypes ||
        (idbProxyableTypes = [
            IDBDatabase,
            IDBObjectStore,
            IDBIndex,
            IDBCursor,
            IDBTransaction,
        ]));
}
// This is a function to prevent it throwing up in node environments.
function getCursorAdvanceMethods() {
    return (cursorAdvanceMethods ||
        (cursorAdvanceMethods = [
            IDBCursor.prototype.advance,
            IDBCursor.prototype.continue,
            IDBCursor.prototype.continuePrimaryKey,
        ]));
}
const transactionDoneMap = new WeakMap();
const transformCache = new WeakMap();
const reverseTransformCache = new WeakMap();
function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
        const unlisten = () => {
            request.removeEventListener('success', success);
            request.removeEventListener('error', error);
        };
        const success = () => {
            resolve(wrap(request.result));
            unlisten();
        };
        const error = () => {
            reject(request.error);
            unlisten();
        };
        request.addEventListener('success', success);
        request.addEventListener('error', error);
    });
    // This mapping exists in reverseTransformCache but doesn't exist in transformCache. This
    // is because we create many promises from a single IDBRequest.
    reverseTransformCache.set(promise, request);
    return promise;
}
function cacheDonePromiseForTransaction(tx) {
    // Early bail if we've already created a done promise for this transaction.
    if (transactionDoneMap.has(tx))
        return;
    const done = new Promise((resolve, reject) => {
        const unlisten = () => {
            tx.removeEventListener('complete', complete);
            tx.removeEventListener('error', error);
            tx.removeEventListener('abort', error);
        };
        const complete = () => {
            resolve();
            unlisten();
        };
        const error = () => {
            console.error(tx);
            console.error(tx.error);
            reject(tx.error || new DOMException('AbortError', 'AbortError'));
            unlisten();
        };
        tx.addEventListener('complete', complete);
        tx.addEventListener('error', error);
        tx.addEventListener('abort', error);
    });
    // Cache it for later retrieval.
    transactionDoneMap.set(tx, done);
}
let idbProxyTraps = {
    get(target, prop, receiver) {
        if (target instanceof IDBTransaction) {
            // Special handling for transaction.done.
            if (prop === 'done')
                return transactionDoneMap.get(target);
            // Make tx.store return the only store in the transaction, or undefined if there are many.
            if (prop === 'store') {
                return receiver.objectStoreNames[1]
                    ? undefined
                    : receiver.objectStore(receiver.objectStoreNames[0]);
            }
        }
        // Else transform whatever we get back.
        return wrap(target[prop]);
    },
    set(target, prop, value) {
        target[prop] = value;
        return true;
    },
    has(target, prop) {
        if (target instanceof IDBTransaction &&
            (prop === 'done' || prop === 'store')) {
            return true;
        }
        return prop in target;
    },
};
function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
}
function wrapFunction(func) {
    // Due to expected object equality (which is enforced by the caching in `wrap`), we
    // only create one new func per func.
    // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
    // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
    // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
    // with real promises, so each advance methods returns a new promise for the cursor object, or
    // undefined if the end of the cursor has been reached.
    if (getCursorAdvanceMethods().includes(func)) {
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            func.apply(unwrap(this), args);
            return wrap(this.request);
        };
    }
    return function (...args) {
        // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
        // the original object.
        return wrap(func.apply(unwrap(this), args));
    };
}
function transformCachableValue(value) {
    if (typeof value === 'function')
        return wrapFunction(value);
    // This doesn't return, it just creates a 'done' promise for the transaction,
    // which is later returned for transaction.done (see idbObjectHandler).
    if (value instanceof IDBTransaction)
        cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
        return new Proxy(value, idbProxyTraps);
    // Return the same value back if we're not going to transform it.
    return value;
}
function wrap(value) {
    // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
    // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
    if (value instanceof IDBRequest)
        return promisifyRequest(value);
    // If we've already transformed this value before, reuse the transformed value.
    // This is faster, but it also provides object equality.
    if (transformCache.has(value))
        return transformCache.get(value);
    const newValue = transformCachableValue(value);
    // Not all types are transformed.
    // These may be primitive types, so they can't be WeakMap keys.
    if (newValue !== value) {
        transformCache.set(value, newValue);
        reverseTransformCache.set(newValue, value);
    }
    return newValue;
}
const unwrap = (value) => reverseTransformCache.get(value);

/**
 * Open a database.
 *
 * @param name Name of the database.
 * @param version Schema version.
 * @param callbacks Additional callbacks.
 */
function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);
    if (upgrade) {
        request.addEventListener('upgradeneeded', (event) => {
            upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
        });
    }
    if (blocked) {
        request.addEventListener('blocked', (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion, event.newVersion, event));
    }
    openPromise
        .then((db) => {
        if (terminated)
            db.addEventListener('close', () => terminated());
        if (blocking) {
            db.addEventListener('versionchange', (event) => blocking(event.oldVersion, event.newVersion, event));
        }
    })
        .catch(() => { });
    return openPromise;
}
/**
 * Delete a database.
 *
 * @param name Name of the database.
 */
function deleteDB(name, { blocked } = {}) {
    const request = indexedDB.deleteDatabase(name);
    if (blocked) {
        request.addEventListener('blocked', (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion, event));
    }
    return wrap(request).then(() => undefined);
}

const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
const writeMethods = ['put', 'add', 'delete', 'clear'];
const cachedMethods = new Map();
function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase &&
        !(prop in target) &&
        typeof prop === 'string')) {
        return;
    }
    if (cachedMethods.get(prop))
        return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, '');
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
        !(isWrite || readMethods.includes(targetFuncName))) {
        return;
    }
    const method = async function (storeName, ...args) {
        // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
        const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
        let target = tx.store;
        if (useIndex)
            target = target.index(args.shift());
        // Must reject if op rejects.
        // If it's a write operation, must reject if tx.done rejects.
        // Must reject with op rejection first.
        // Must resolve with op value.
        // Must handle both promises (no unhandled rejections)
        return (await Promise.all([
            target[targetFuncName](...args),
            isWrite && tx.done,
        ]))[0];
    };
    cachedMethods.set(prop, method);
    return method;
}
replaceTraps((oldTraps) => ({
    ...oldTraps,
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
}));

const advanceMethodProps = ['continue', 'continuePrimaryKey', 'advance'];
const methodMap = {};
const advanceResults = new WeakMap();
const ittrProxiedCursorToOriginalProxy = new WeakMap();
const cursorIteratorTraps = {
    get(target, prop) {
        if (!advanceMethodProps.includes(prop))
            return target[prop];
        let cachedFunc = methodMap[prop];
        if (!cachedFunc) {
            cachedFunc = methodMap[prop] = function (...args) {
                advanceResults.set(this, ittrProxiedCursorToOriginalProxy.get(this)[prop](...args));
            };
        }
        return cachedFunc;
    },
};
async function* iterate(...args) {
    // tslint:disable-next-line:no-this-assignment
    let cursor = this;
    if (!(cursor instanceof IDBCursor)) {
        cursor = await cursor.openCursor(...args);
    }
    if (!cursor)
        return;
    cursor = cursor;
    const proxiedCursor = new Proxy(cursor, cursorIteratorTraps);
    ittrProxiedCursorToOriginalProxy.set(proxiedCursor, cursor);
    // Map this double-proxy back to the original, so other cursor methods work.
    reverseTransformCache.set(proxiedCursor, unwrap(cursor));
    while (cursor) {
        yield proxiedCursor;
        // If one of the advancing methods was not called, call continue().
        cursor = await (advanceResults.get(proxiedCursor) || cursor.continue());
        advanceResults.delete(proxiedCursor);
    }
}
function isIteratorProp(target, prop) {
    return ((prop === Symbol.asyncIterator &&
        instanceOfAny(target, [IDBIndex, IDBObjectStore, IDBCursor])) ||
        (prop === 'iterate' && instanceOfAny(target, [IDBIndex, IDBObjectStore])));
}
replaceTraps((oldTraps) => ({
    ...oldTraps,
    get(target, prop, receiver) {
        if (isIteratorProp(target, prop))
            return iterate;
        return oldTraps.get(target, prop, receiver);
    },
    has(target, prop) {
        return isIteratorProp(target, prop) || oldTraps.has(target, prop);
    },
}));




/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
/*!*******************************************!*\
  !*** ./client/InitialiseIndexDbBlazor.ts ***!
  \*******************************************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
const indexedDbBlazor_1 = __webpack_require__(/*! ./indexedDbBlazor */ "./client/indexedDbBlazor.ts");
var IndexDb;
(function (IndexDb) {
    const timeghostExtensions = 'TimeGhost';
    const extensionObject = {
        IndexedDbManager: new indexedDbBlazor_1.IndexedDbManager()
    };
    function initialise() {
        if (typeof window !== 'undefined' && !window[timeghostExtensions]) {
            window[timeghostExtensions] = Object.assign({}, extensionObject);
        }
        else {
            window[timeghostExtensions] = Object.assign(Object.assign({}, window[timeghostExtensions]), extensionObject);
        }
    }
    IndexDb.initialise = initialise;
})(IndexDb || (IndexDb = {}));
IndexDb.initialise();

})();

/******/ })()
;