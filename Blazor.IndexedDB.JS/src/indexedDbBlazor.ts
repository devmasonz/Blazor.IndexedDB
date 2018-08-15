﻿/// <reference path="Microsoft.JSInterop.d.ts"/>

interface ISingleRecord {
    storename: string;
    data: object;
}

interface IIndexSpec {
    name: string;
    keyPath: string;
    unique?: boolean;
    auto: boolean;
}

interface ITableSchema {
    dbVersion?: number;
    name: string;
    primaryKey: IIndexSpec;
    indexes: IIndexSpec[];
}

interface IDbStore {
    name: string;
    version: number;
    tables: ITableSchema[];

}

export class IndexedDbManager {
    private db: any;
    private assemblyName = 'Blazor.IndexedDB';
    private promiseCallback = 'PromiseCallback';
   private promiseError = 'PromiseError';

    public runFunction = (callbackId: string, fnName: string, data: any): boolean => {

        console.log('Start runFunction');

       const promise = this[fnName](data);

        promise.then(value => {
            if (value === undefined) {
                value = '';
            }
                const result =  JSON.stringify(value);
                DotNet.invokeMethodAsync(this.assemblyName, this.promiseCallback,callbackId, result);
            })
            .catch(reason => {
                const result = JSON.stringify(reason);
                DotNet.invokeMethodAsync(this.assemblyName, this.promiseError,callbackId, result);
            });

        return true;
    }

    public createDb = (data): Promise<string> => {
        const dbStore = data as IDbStore;
        console.log("createDb");
        return new Promise<string>((resolve, reject) => {
            const openRequest = window.indexedDB.open(dbStore.name, dbStore.version);

            openRequest.onsuccess = ev => {
                this.db = openRequest.result;
                resolve(`Database ${dbStore.name} created. Version: ${dbStore.version}`);
            } 

            openRequest.onerror = ev => {
                reject(`Failed to create database ${dbStore.name}`);
        }

            openRequest.onupgradeneeded = (ev: IDBVersionChangeEvent) => {
                const db = openRequest.result;
                if (dbStore.tables) {
                    for (let i = 0; i < dbStore.tables.length; i++) {
                        const table = dbStore.tables[i];
                        const primaryKey = table.primaryKey;
                        const store = db.createObjectStore(table.name,
                            { keyPath: primaryKey.name, autoIncrement: primaryKey.auto });

                        for (let j = 0; j < table.indexes.length; j++) {
                            const index = table.indexes[j];
                            store.createIndex(index.name, index.keyPath, { unique: index.unique });
                        }
                    }
                }
            }
        });
    }

    public addItem = (record: ISingleRecord):Promise<string> => {
        const stName = record.storename;
        const itemToSave = record.data;
        const store = this.getObjectStore(stName, 'readwrite');
        
        return new Promise<string>((resolve, reject) => {
            const req: IDBRequest = store.add(itemToSave);

            req.onsuccess = ev => {
                console.log('Insertion successful');
                resolve('Record added');
            }
            req.onerror = ev => {
                reject('Failed to added record');
            }
        });
    }

   public getObjectStore = (storeName: string, mode: string) :IDBObjectStore  => {
        const tx: IDBTransaction = this.db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    }

    public testFunction = (message: string):string => {
        const testVar = this.assemblyName;
        return `${message}: ${testVar}`;
    }
}