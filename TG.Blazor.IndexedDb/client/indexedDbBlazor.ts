///// <reference path="Microsoft.JSInterop.d.ts"/>
import { openDB, deleteDB, DBSchema, IDBPDatabase, IDBPTransaction, IDBPObjectStore } from 'idb';
import { IDbStore, IIndexSearch, IIndexSpec, IStoreRecord, IStoreSchema, IDotNetInstanceWrapper, IDbInformation } from './InteropInterfaces';

export class IndexedDbManager {

    private dbInstance: IDBPDatabase<any> | undefined = undefined;
    private dotnetCallback = (message: string) => { };

    constructor() { }

    public openDb = async (data: IDbStore, instanceWrapper: IDotNetInstanceWrapper): Promise<string> => {
        const dbStore = data;
        //just a test for the moment
        this.dotnetCallback = (message: string) => {
            instanceWrapper.instance.invokeMethodAsync(instanceWrapper.methodName, message);
        }

        try {
            if (!this.dbInstance || this.dbInstance.version < dbStore.version) {
                if (this.dbInstance) {
                    this.dbInstance.close();
                }
                this.dbInstance = await openDB(dbStore.dbName, dbStore.version, {
                    upgrade: (db, oldVersion, newVersion, transaction) => {
                        this.upgradeDatabase(db, oldVersion, dbStore);
                    }
                });
            }
        } catch (e) {
            this.dbInstance = await openDB(dbStore.dbName);
        }
        
        return `IndexedDB ${data.dbName} opened`;
    }

    public getDbInfo = async (dbName: string) : Promise<IDbInformation> => {
        if (!this.dbInstance) {
            this.dbInstance = await openDB(dbName);
        }

        const currentDb = this.dbInstance;

        let getStoreNames = (list: DOMStringList): string[] => {
            let names: string[] = [];
            for (var i = 0; i < list.length; i++) {
                names.push(list[i]);
            }
            return names;
        }
        const dbInfo: IDbInformation = {
            version: currentDb.version,
            storeNames: getStoreNames(currentDb.objectStoreNames)
        };

        return dbInfo;
    }

    public deleteDb = async(dbName: string): Promise<string> => {
        if (this.dbInstance) {
            this.dbInstance.close();
        }

        await deleteDB(dbName);

        this.dbInstance = undefined;

        return `The database ${dbName} has been deleted`;
    }

    public addRecord = async (record: IStoreRecord): Promise<string> => {
        const stName = record.storeName;
        let itemToSave = record.data;
        
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = this.dbInstance.transaction(stName, 'readwrite');
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
        
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = this.dbInstance.transaction(stName, 'readwrite');
        const result = record.key ? 
            await tx.objectStore(stName).put(record.data, record.key) : 
            await tx.objectStore(stName).put(record.data);
        
        await tx.done;
        return `updated record with id ${result}`;
    }

    public getRecords = async (storeName: string): Promise<any> => {
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = this.dbInstance.transaction(storeName, 'readonly');
        const results = await tx.objectStore(storeName).getAll();
        await tx.done;

        return results;
    }

    public clearStore = async (storeName: string): Promise<string> => {
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = this.dbInstance.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).clear();
        await tx.done;

        return `Store ${storeName} cleared`;
    }

    public getRecordByIndex = async (searchData: IIndexSearch): Promise<any> => {
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = this.dbInstance.transaction(searchData.storeName, 'readonly');
        const results = await tx.objectStore(searchData.storeName)
            .index(searchData.indexName)
            .get(searchData.queryValue);

        await tx.done;
        return results;
    }

    public getAllRecordsByIndex = async (searchData: IIndexSearch): Promise<any> => {
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = this.dbInstance.transaction(searchData.storeName, 'readonly');
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
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = this.dbInstance.transaction(storeName, 'readonly');
        let result = await tx.objectStore(storeName).get(id);
        await tx.done;
        return result;
    }

    public deleteRecord = async (storeName: string, id: any): Promise<string> => {
        if (!this.dbInstance) {
            throw new Error("Database instance not initialized");
        }
        
        const tx = this.dbInstance.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).delete(id);
        await tx.done;

        return `Record with id: ${id} deleted`;
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