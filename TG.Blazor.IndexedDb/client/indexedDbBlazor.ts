///// <reference path="Microsoft.JSInterop.d.ts"/>
import { openDB, deleteDB, DBSchema, IDBPDatabase, IDBPTransaction, IDBPObjectStore } from 'idb';
import { IDbStore, IIndexSearch, IIndexSpec, IStoreRecord, IStoreSchema, IDotNetInstanceWrapper, IDbInformation } from './InteropInterfaces';

export class IndexedDbManager {

    // Replace single dbInstance with a map of database instances
    private dbInstances: Map<string, IDBPDatabase<any>> = new Map();
    private currentDbName: string = '';
    private dotnetCallback = (message: string) => { };

    constructor() { }

    public openDb = async (data: IDbStore, instanceWrapper: IDotNetInstanceWrapper): Promise<string> => {
        const dbStore = data;
        //just a test for the moment
        this.dotnetCallback = (message: string) => {
            instanceWrapper.instance.invokeMethodAsync(instanceWrapper.methodName, message);
        }

        try {
            // Store the current database name for operations
            this.currentDbName = dbStore.dbName;
            
            const existingDb = this.dbInstances.get(dbStore.dbName);
            if (!existingDb || existingDb.version < dbStore.version) {
                if (existingDb) {
                    existingDb.close();
                }
                const newDb = await openDB(dbStore.dbName, dbStore.version, {
                    upgrade: (db, oldVersion, newVersion, transaction) => {
                        this.upgradeDatabase(db, oldVersion, dbStore);
                    }
                });
                this.dbInstances.set(dbStore.dbName, newDb);
            }
        } catch (e) {
            const db = await openDB(dbStore.dbName);
            this.dbInstances.set(dbStore.dbName, db);
        }
        
        return `IndexedDB ${data.dbName} opened`;
    }

    public getDbInfo = async (dbName: string) : Promise<IDbInformation> => {
        // Set the current database name
        this.currentDbName = dbName;
        
        let db = this.dbInstances.get(dbName);
        if (!db) {
            db = await openDB(dbName);
            this.dbInstances.set(dbName, db);
        }

        let getStoreNames = (list: DOMStringList): string[] => {
            let names: string[] = [];
            for (var i = 0; i < list.length; i++) {
                names.push(list[i]);
            }
            return names;
        }
        const dbInfo: IDbInformation = {
            version: db.version,
            storeNames: getStoreNames(db.objectStoreNames)
        };

        return dbInfo;
    }

    public deleteDb = async(dbName: string): Promise<string> => {
        const db = this.dbInstances.get(dbName);
        if (db) {
            db.close();
            this.dbInstances.delete(dbName);
        }

        await deleteDB(dbName);

        if (this.currentDbName === dbName) {
            this.currentDbName = '';
        }

        return `The database ${dbName} has been deleted`;
    }

    public addRecord = async (record: IStoreRecord): Promise<string> => {
        const stName = record.storeName;
        let itemToSave = record.data;
        
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = db.transaction(stName, 'readwrite');
        const objectStore = tx.objectStore(stName);

        itemToSave = this.checkForKeyPath(objectStore, itemToSave);

        const result = record.key ? 
            await objectStore.add(itemToSave, record.key) : 
            await objectStore.add(itemToSave);

        await tx.done;
        return `Added new record with id ${result}`;
    }

    public updateRecord = async (record: IStoreRecord): Promise<string> => {
        const stName = record.storeName;
        
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = db.transaction(stName, 'readwrite');
        const result = record.key ? 
            await tx.objectStore(stName).put(record.data, record.key) : 
            await tx.objectStore(stName).put(record.data);
        
        await tx.done;
        return `updated record with id ${result}`;
    }

    public getRecords = async (storeName: string): Promise<any> => {
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = db.transaction(storeName, 'readonly');
        const results = await tx.objectStore(storeName).getAll();
        await tx.done;

        return results;
    }

    public clearStore = async (storeName: string): Promise<string> => {
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = db.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).clear();
        await tx.done;

        return `Store ${storeName} cleared`;
    }

    public getRecordByIndex = async (searchData: IIndexSearch): Promise<any> => {
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = db.transaction(searchData.storeName, 'readonly');
        const results = await tx.objectStore(searchData.storeName)
            .index(searchData.indexName)
            .get(searchData.queryValue);

        await tx.done;
        return results;
    }

    public getAllRecordsByIndex = async (searchData: IIndexSearch): Promise<any> => {
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = db.transaction(searchData.storeName, 'readonly');
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
    }

    public getRecordById = async (storeName: string, id: any): Promise<any> => {
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = db.transaction(storeName, 'readonly');
        let result = await tx.objectStore(storeName).get(id);
        await tx.done;
        return result;
    }

    public deleteRecord = async (storeName: string, id: any): Promise<string> => {
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = db.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).delete(id);
        await tx.done;

        return `Record with id: ${id} deleted`;
    }

    public getAllDatabaseNames = async (): Promise<string[]> => {
        // Use indexedDB.databases() where available (modern browsers)
        if ('databases' in indexedDB) {
            try {
                const databases = await indexedDB.databases();
                return databases.map(db => db.name).filter(name => name !== null) as string[];
            } catch (e) {
                console.error('Error getting database names:', e);
                return [];
            }
        } else {
            // Return only known databases for older browsers
            return Array.from(this.dbInstances.keys());
        }
    }

    public renameStore = async (oldName: string, newName: string): Promise<string> => {
        const db = this.getCurrentDb();
        if (!db) {
            throw new Error("Database instance not initialized");
        }
        
        // IDBPDatabase doesn't have renameObjectStore method
        // We need to create a new store with the new name and copy data
        const tx = db.transaction(oldName, 'readwrite');
        const oldStore = tx.objectStore(oldName);
        
        // Get all data from old store
        const allData = await oldStore.getAll();
        await tx.done;
        
        // Create new store and delete old one in a versionchange transaction
        const newVersion = db.version + 1;
        await db.close();
        
        const upgradedDb = await openDB(this.currentDbName, newVersion, {
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
        
        // remove the database instance in our map and add the new one
        this.dbInstances.delete(oldName);
        this.dbInstances.set(newName, upgradedDb);
        
        return `Store ${oldName} renamed to ${newName}`;
    }

    // Helper method to get the current database instance
    private getCurrentDb(): IDBPDatabase<any> | undefined {
        return this.dbInstances.get(this.currentDbName);
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
}