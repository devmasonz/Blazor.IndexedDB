///// <reference path="Microsoft.JSInterop.d.ts"/>
import { openDB, deleteDB, DBSchema, IDBPDatabase, IDBPTransaction, IDBPObjectStore } from 'idb';
import { IDbStore, IIndexSearch, IIndexSpec, IStoreRecord, IStoreSchema, IDotNetInstanceWrapper, IDbInformation, IIndexedDbError } from './InteropInterfaces';

export class IndexedDbManager {
    // Single database instance for this manager
    private dbInstance: IDBPDatabase<any> | null = null;
    // Current database name
    private dbName: string = '';
    // Default callback
    private dotnetCallback = (message: string) => { };
    // Error callback
    private errorCallback = (error: IIndexedDbError) => { };

    constructor() { }

    public openDb = async (data: IDbStore, instanceWrapper: IDotNetInstanceWrapper): Promise<string> => {
        const dbStore = data;
        //Set up callback
        this.dotnetCallback = (message: string) => {
            instanceWrapper.instance.invokeMethodAsync(instanceWrapper.methodName, message);
        }
        
        // Set up error callback
        this.errorCallback = (error: IIndexedDbError) => {
            instanceWrapper.instance.invokeMethodAsync("ErrorCallback", error);
        }

        try {
            // Store the database name
            this.dbName = dbStore.dbName;
            
            // Close existing database if it's open and different from the requested one
            // or if the version needs upgrading
            if (this.dbInstance) {
                if (this.dbInstance.name !== dbStore.dbName || this.dbInstance.version < dbStore.version) {
                    this.dbInstance.close();
                    this.dbInstance = null;
                }
            }
            
            // Only open a new database if we don't have one open already
            if (!this.dbInstance) {
                this.dbInstance = await openDB(dbStore.dbName, dbStore.version, {
                    upgrade: (db, oldVersion, newVersion, transaction) => {
                        this.upgradeDatabase(db, oldVersion, dbStore);
                    }
                });
            }
        } catch (e) {
            // Handle error case
            try {
                this.dbInstance = await openDB(dbStore.dbName);
            } catch (innerErr) {
                // If we can't open the database at all, report the error
                this.reportError(innerErr);
                throw innerErr;
            }
        }
        
        return `IndexedDB ${data.dbName} opened`;
    }

    public getDbInfo = async (dbName: string, dotNetRef?: any) : Promise<IDbInformation> => {
        try {
            // Ensure we're working with the right database
            if (this.dbName !== dbName) {
                if (this.dbInstance) {
                    this.dbInstance.close();
                }
                this.dbInstance = await openDB(dbName);
                this.dbName = dbName;
            }
            
            if (!this.dbInstance) {
                throw new Error("Database instance not initialized");
            }
            
            let getStoreNames = (list: DOMStringList): string[] => {
                let names: string[] = [];
                for (var i = 0; i < list.length; i++) {
                    names.push(list[i]);
                }
                return names;
            }
            
            const dbInfo: IDbInformation = {
                version: this.dbInstance.version,
                storeNames: getStoreNames(this.dbInstance.objectStoreNames)
            };

            return dbInfo;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public deleteDb = async(dbName: string): Promise<string> => {
        try {
            // Close the database if it's the one we have open
            if (this.dbInstance && this.dbInstance.name === dbName) {
                this.dbInstance.close();
                this.dbInstance = null;
                this.dbName = '';
            }

            await deleteDB(dbName);
            return `The database ${dbName} has been deleted`;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public addRecord = async (record: IStoreRecord, dotNetRef?: any): Promise<string> => {
        try {
            this.ensureDbIsOpen();
            
            const stName = record.storeName;
            let itemToSave = record.data;
            
            const tx = this.dbInstance!.transaction(stName, 'readwrite');
            const objectStore = tx.objectStore(stName);

            itemToSave = this.checkForKeyPath(objectStore, itemToSave);

            const result = record.key ? 
                await objectStore.add(itemToSave, record.key) : 
                await objectStore.add(itemToSave);

            await tx.done;
            return `Added new record with id ${result}`;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public updateRecord = async (record: IStoreRecord, dotNetRef?: any): Promise<string> => {
        try {
            this.ensureDbIsOpen();
            
            const stName = record.storeName;
            
            const tx = this.dbInstance!.transaction(stName, 'readwrite');
            const result = record.key ? 
                await tx.objectStore(stName).put(record.data, record.key) : 
                await tx.objectStore(stName).put(record.data);
            
            await tx.done;
            return `updated record with id ${result}`;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public getRecords = async (storeName: string, dotNetRef?: any): Promise<any> => {
        try {
            this.ensureDbIsOpen();
            
            const tx = this.dbInstance!.transaction(storeName, 'readonly');
            const results = await tx.objectStore(storeName).getAll();
            await tx.done;

            return results;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public clearStore = async (storeName: string, dotNetRef?: any): Promise<string> => {
        try {
            this.ensureDbIsOpen();
            
            const tx = this.dbInstance!.transaction(storeName, 'readwrite');
            await tx.objectStore(storeName).clear();
            await tx.done;

            return `Store ${storeName} cleared`;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public getRecordByIndex = async (searchData: IIndexSearch, dotNetRef?: any): Promise<any> => {
        try {
            this.ensureDbIsOpen();
            
            const tx = this.dbInstance!.transaction(searchData.storeName, 'readonly');
            const results = await tx.objectStore(searchData.storeName)
                .index(searchData.indexName)
                .get(searchData.queryValue);

            await tx.done;
            return results;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public getAllRecordsByIndex = async (searchData: IIndexSearch, dotNetRef?: any): Promise<any> => {
        try {
            this.ensureDbIsOpen();
            
            const tx = this.dbInstance!.transaction(searchData.storeName, 'readonly');
            const index = tx.objectStore(searchData.storeName).index(searchData.indexName);
            let results: any[] = [];

            // Using async iteration instead of iterateCursor (which was removed in idb 4.x)
            let cursor = await index.openCursor();
            while (cursor) {
                if (cursor.key === searchData.queryValue) {
                    results.push(cursor.value);
                }
                cursor = await cursor.continue();
            }

            await tx.done;
            return results;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public getRecordById = async (storeName: string, id: any, dotNetRef?: any): Promise<any> => {
        try {
            this.ensureDbIsOpen();
            
            const tx = this.dbInstance!.transaction(storeName, 'readonly');
            let result = await tx.objectStore(storeName).get(id);
            await tx.done;
            return result;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public deleteRecord = async (storeName: string, id: any, dotNetRef?: any): Promise<string> => {
        try {
            this.ensureDbIsOpen();
            
            const tx = this.dbInstance!.transaction(storeName, 'readwrite');
            await tx.objectStore(storeName).delete(id);
            await tx.done;

            return `Record with id: ${id} deleted`;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    public getAllDatabaseNames = async (): Promise<string[]> => {
        // Use indexedDB.databases() where available (modern browsers)
        if ('databases' in indexedDB) {
            try {
                const databases = await indexedDB.databases();
                return databases.map(db => db.name).filter(name => name !== null) as string[];
            } catch (e) {
                console.error('Error getting database names:', e);
                this.reportError(e);
                return [];
            }
        } else {
            // Return only the current database name if we have one
            return this.dbName ? [this.dbName] : [];
        }
    }

    public renameStore = async (oldName: string, newName: string, dotNetRef?: any): Promise<string> => {
        try {
            this.ensureDbIsOpen();
            
            // IDBPDatabase doesn't have renameObjectStore method
            // We need to create a new store with the new name and copy data
            const tx = this.dbInstance!.transaction(oldName, 'readwrite');
            const oldStore = tx.objectStore(oldName);
            
            // Get all data from old store
            const allData = await oldStore.getAll();
            await tx.done;
            
            // Create new store and delete old one in a versionchange transaction
            const newVersion = this.dbInstance!.version + 1;
            await this.dbInstance!.close();
            
            const upgradedDb = await openDB(this.dbName, newVersion, {
                upgrade(database, oldVersion, newVersion, transaction) {
                    // Get old store's configuration
                    const oldStoreConfig = database.objectStoreNames.contains(oldName) ? 
                        transaction.objectStore(oldName) : null;
                    
                    if (oldStoreConfig) {
                        // Create new store with same configuration
                        const newStore = database.createObjectStore(newName, {
                            keyPath: oldStoreConfig.keyPath,
                            autoIncrement: oldStoreConfig.autoIncrement
                        });
                        
                        // Recreate indexes
                        for (const indexName of oldStoreConfig.indexNames) {
                            const index = oldStoreConfig.index(indexName);
                            newStore.createIndex(indexName, index.keyPath, {
                                unique: index.unique,
                                multiEntry: index.multiEntry
                            });
                        }
                        
                        // Delete old store
                        database.deleteObjectStore(oldName);
                    }
                }
            });
            
            // Add data to new store
            if (allData.length > 0) {
                const newTx = upgradedDb.transaction(newName, 'readwrite');
                const newStore = newTx.objectStore(newName);
                for (const item of allData) {
                    await newStore.add(item);
                }
                await newTx.done;
            }
            
            // Update our database instance
            this.dbInstance = upgradedDb;
            
            return `Store ${oldName} renamed to ${newName}`;
        } catch (err) {
            this.reportError(err);
            throw err;
        }
    }

    // Helper method to ensure database is open
    private ensureDbIsOpen(): void {
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized. Call openDb first.");
        }
    }

    // Currently don't support aggregate keys
    private checkForKeyPath(objectStore: IDBPObjectStore<any, any, any, any>, data: any) {
        if (!objectStore.autoIncrement || !objectStore.keyPath) {
            return data;
        }

        if (typeof objectStore.keyPath !== 'string') {
            return data;
        }

        const keyPath = objectStore.keyPath as string;

        if (!data[keyPath]) {
            delete data[keyPath];
        }
        return data;
    }

    private upgradeDatabase(db: IDBPDatabase, oldVersion: number, dbStore: IDbStore) {
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

    private addNewStore(db: IDBPDatabase, store: IStoreSchema) {
        let primaryKey = store.primaryKey;

        if (!primaryKey) {
            primaryKey = { name: 'id', keyPath: 'id', auto: true };
        }

        const newStore = db.createObjectStore(store.name, { keyPath: primaryKey.keyPath, autoIncrement: primaryKey.auto });

        for (var index of store.indexes) {
            newStore.createIndex(index.name, index.keyPath, { unique: index.unique });
        }
    }

    // Report error to .NET
    private reportError(error: any): void {
        const errorObj: IIndexedDbError = {
            message: error?.message || 'Unknown error',
            name: error?.name || 'Error',
            stack: error?.stack,
            code: error?.code
        };
        
        console.error('IndexedDB error:', error);
        
        if (typeof this.errorCallback === 'function') {
            this.errorCallback(errorObj);
        }
    }
}