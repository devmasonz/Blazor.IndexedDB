﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.JSInterop;

namespace TG.Blazor.IndexedDB
{
    /// <summary>
    /// Custom exception for IndexedDB operations
    /// </summary>
    public class IndexedDbException : Exception
    {
        public string ErrorName { get; }
        public int? ErrorCode { get; }

        public IndexedDbException(string message, string name, int? code = null, string? stack = null)
            : base($"{name}: {message}{(stack != null ? Environment.NewLine + stack : string.Empty)}")
        {
            ErrorName = name;
            ErrorCode = code;
        }
    }

    /// <summary>
    /// Provides functionality for accessing IndexedDB from Blazor application.
    /// Each instance maintains a connection to a single database.
    /// </summary>
    public class IndexedDBManager : IAsyncDisposable
    {
        private readonly DbStore _dbStore;
        private readonly IJSRuntime _jsRuntime;
        private const string InteropPrefix = "TimeGhost.IndexedDbManager";
        private bool _isOpen;
        private string _currentDbName;
        private DotNetObjectReference<IndexedDBManager>? _dotNetRef;

        /// <summary>
        /// A notification event that is raised when an action is completed
        /// </summary>
        public event EventHandler<IndexedDBNotificationArgs>? ActionCompleted;

        public IndexedDBManager(DbStore dbStore, IJSRuntime jsRuntime)
        {
            _dbStore = dbStore;
            _jsRuntime = jsRuntime;
            _currentDbName = dbStore.DbName;
            _dotNetRef = DotNetObjectReference.Create(this);
        }

        public List<StoreSchema> Stores => _dbStore.Stores;
        public int CurrentVersion => _dbStore.Version;
        public string DbName => _dbStore.DbName;
        
        /// <summary>
        /// Gets a list of all IndexedDB database names available in the browser
        /// </summary>
        /// <returns>A list of database names</returns>
        public async Task<List<string>> GetAllDatabaseNames()
        {
            try
            {
                var databaseNames = await CallJavascript<List<string>>(DbFunctions.GetAllDatabaseNames);
                RaiseNotification(IndexDBActionOutCome.Successful, $"Retrieved {databaseNames.Count} database names");
                return databaseNames;
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, jse.Message);
                return new List<string>();
            }
        }

        public async Task RenameStore(string oldName, string newName)
        {
            await EnsureDbOpen();
            await CallJavascript<string>(DbFunctions.RenameStore, oldName, newName, _dotNetRef);
        }
        
        /// <summary>
        /// Opens the IndexedDB defined in the DbStore. Under the covers will create the database if it does not exist
        /// and create the stores defined in DbStore.
        /// </summary>
        /// <returns></returns>
        public async Task OpenDb()
        {
            if (_isOpen && _currentDbName == _dbStore.DbName)
            {
                return;
            }

            var result = await CallJavascript<string>(DbFunctions.OpenDb, _dbStore, new { Instance = _dotNetRef, MethodName= "Callback"});
            _isOpen = true;
            _currentDbName = _dbStore.DbName;

            await GetCurrentDbState();

            RaiseNotification(IndexDBActionOutCome.Successful, result);
        }

        /// <summary>
        /// Deletes the database corresponding to the dbName passed in
        /// </summary>
        /// <param name="dbName">The name of database to delete</param>
        /// <returns></returns>
        public async Task DeleteDb(string dbName)
        {
            if (string.IsNullOrEmpty(dbName))
            {
                throw new ArgumentException("dbName cannot be null or empty", nameof(dbName));
            }
            
            var result = await CallJavascript<string>(DbFunctions.DeleteDb, dbName);

            // Reset state if we deleted our current database
            if (dbName == _currentDbName)
            {
                _isOpen = false;
                _currentDbName = _dbStore.DbName;
            }

            RaiseNotification(IndexDBActionOutCome.Successful, result);
        }

        public async Task GetCurrentDbState()
        {
            await EnsureDbOpen();

            var result = await CallJavascript<DbInformation>(DbFunctions.GetDbInfo, _dbStore.DbName, _dotNetRef);

            if (result.Version > _dbStore.Version)
            {
                _dbStore.Version = result.Version;

                var currentStores = _dbStore.Stores.Select(s => s.Name).ToList();

                foreach (var storeName in result.StoreNames)
                {
                    if (!currentStores.Contains(storeName))
                    {
                        _dbStore.Stores.Add(new StoreSchema { DbVersion = result.Version, Name = storeName });
                    }
                }
            }
        }

        /// <summary>
        /// This function provides the means to add a store to an existing database,
        /// </summary>
        /// <param name="storeSchema"></param>
        /// <returns></returns>
        public async Task AddNewStore(StoreSchema storeSchema)
        {
            if (storeSchema == null)
            {
                return;
            }

            if (_dbStore.Stores.Any(s => s.Name == storeSchema.Name))
            {
                return;
            }

            _dbStore.Stores.Add(storeSchema);
            _dbStore.Version += 1;

            // Force reopen with new version
            _isOpen = false;
            var result = await CallJavascript<string>(DbFunctions.OpenDb, _dbStore, new { Instance = _dotNetRef, MethodName = "Callback" });
            _isOpen = true;

            RaiseNotification(IndexDBActionOutCome.Successful, $"new store {storeSchema.Name} added");
        }

        /// <summary>
        /// Adds a new record/object to the specified store
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="recordToAdd">An instance of StoreRecord that provides the store name and the data to add</param>
        /// <returns></returns>
        public async Task AddRecord<T>(StoreRecord<T> recordToAdd)
        {
            await EnsureDbOpen();
            try
            {
                var result = await CallJavascript<StoreRecord<T>, string>(DbFunctions.AddRecord, recordToAdd, _dotNetRef);
                RaiseNotification(IndexDBActionOutCome.Successful, result);
            }
            catch (JSException e)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, e.Message);
            }
        }

        /// <summary>
        /// Updates and existing record
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="recordToUpdate">An instance of StoreRecord with the store name and the record to update</param>
        /// <returns></returns>
        public async Task UpdateRecord<T>(StoreRecord<T> recordToUpdate)
        {
            await EnsureDbOpen();
            try
            {
                var result = await CallJavascript<StoreRecord<T>, string>(DbFunctions.UpdateRecord, recordToUpdate, _dotNetRef);
                RaiseNotification(IndexDBActionOutCome.Successful, result);
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, jse.Message);
            }
        }

        /// <summary>
        /// Gets all of the records in a given store.
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="storeName">The name of the store from which to retrieve the records</param>
        /// <returns></returns>
        public async Task<List<TResult>?> GetRecords<TResult>(string storeName)
        {
            await EnsureDbOpen();
            try
            {
                var results = await CallJavascript<List<TResult>>(DbFunctions.GetRecords, storeName, _dotNetRef);

                RaiseNotification(IndexDBActionOutCome.Successful, $"Retrieved {results.Count} records from {storeName}");

                return results;
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, jse.Message);
                return null;
            }
           
        }

        /// <summary>
        /// Retrieve a record by id
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="storeName">The name of the  store to retrieve the record from</param>
        /// <param name="id">the id of the record</param>
        /// <returns></returns>
        public async Task<TResult?> GetRecordById<TInput, TResult>(string storeName, TInput id)
        {
            if (id == null)
            {
                throw new ArgumentNullException(nameof(id), "The id parameter cannot be null.");
            }
            
            await EnsureDbOpen();
            
            try
            {
                var record = await CallJavascript<TResult>(DbFunctions.GetRecordById, storeName, id, _dotNetRef);

                return record;
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, jse.Message);
                return default;
            }
        }
        
        /// <summary>
        /// Deletes a record from the store based on the id
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <param name="storeName"></param>
        /// <param name="id"></param>
        /// <returns></returns>
        public async Task DeleteRecord<TInput>(string storeName, TInput id)
        {
            if (id == null)
            {
                throw new ArgumentNullException(nameof(id), "The id parameter cannot be null.");
            }
            
            try
            {
                await EnsureDbOpen();
                await CallJavascript<string>(DbFunctions.DeleteRecord, storeName, id, _dotNetRef);
                RaiseNotification(IndexDBActionOutCome.Deleted, $"Deleted from {storeName} record: {id}");
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, jse.Message);
            }
        }

        /// <summary>
        /// Clears all of the records from a given store.
        /// </summary>
        /// <param name="storeName">The name of the store to clear the records from</param>
        /// <returns></returns>
        public async Task ClearStore(string storeName)
        {
            if (string.IsNullOrEmpty(storeName))
            {
                throw new ArgumentException("Parameter cannot be null or empty", nameof(storeName));
            }

            try
            {
                await EnsureDbOpen();
                var result = await CallJavascript<string>(DbFunctions.ClearStore, storeName, _dotNetRef);
                RaiseNotification(IndexDBActionOutCome.Successful, result);
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, jse.Message);

            }
            
        }

        /// <summary>
        /// Returns the first record that matches a query against a given index
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery">an instance of StoreIndexQuery</param>
        /// <returns></returns>
        public async Task<TResult?> GetRecordByIndex<TInput, TResult>(StoreIndexQuery<TInput> searchQuery)
        {
            await EnsureDbOpen();

            try
            {
                var result = await CallJavascript<StoreIndexQuery<TInput>, TResult>(DbFunctions.GetRecordByIndex, searchQuery, _dotNetRef);
                return result;
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, jse.Message);
                return default;
            }
        }
        
        /// <summary>
        /// Gets all of the records that match a given query in the specified index.
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IList<TResult>?> GetAllRecordsByIndex<TInput, TResult>(StoreIndexQuery<TInput> searchQuery)
        {
            await EnsureDbOpen();
            try
            {
                var results = await CallJavascript<StoreIndexQuery<TInput>, IList<TResult>>(DbFunctions.GetAllRecordsByIndex, searchQuery, _dotNetRef);
                RaiseNotification(IndexDBActionOutCome.Successful, 
                    $"Retrieved {results.Count} records, for {searchQuery.QueryValue} on index {searchQuery.IndexName}");
                return results;
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutCome.Failed, jse.Message);
                return null;
            }
        }

        [JSInvokable("Callback")]
        public void CalledFromJS(string message)
        {
            Console.WriteLine($"called from JS: {message}");
        }
        
        [JSInvokable("ErrorCallback")]
        public void ErrorFromJS(object errorData)
        {
            try
            {
                var errorName = "Unknown";
                var errorMessage = "Unknown error";
                int? errorCode = null;
                
                // Try to extract error properties based on the passed object
                if (errorData is System.Text.Json.JsonElement jsonElement)
                {
                    if (jsonElement.TryGetProperty("name", out var nameElement) && nameElement.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        errorName = nameElement.GetString() ?? errorName;
                    }
                    
                    if (jsonElement.TryGetProperty("message", out var messageElement) && messageElement.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        errorMessage = messageElement.GetString() ?? errorMessage;
                    }
                    
                    if (jsonElement.TryGetProperty("code", out var codeElement) && codeElement.ValueKind == System.Text.Json.JsonValueKind.Number)
                    {
                        errorCode = codeElement.GetInt32();
                    }
                }
                
                var exception = new IndexedDbException(errorMessage, errorName, errorCode);
                RaiseNotification(IndexDBActionOutCome.Failed, exception.Message);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error handling JavaScript error callback: {ex.Message}");
                RaiseNotification(IndexDBActionOutCome.Failed, "Error handling JavaScript error");
            }
        }
        
        private async Task<TResult> CallJavascript<TData, TResult>(string functionName, TData data, DotNetObjectReference<IndexedDBManager>? dotNetRef = null)
        {
            try
            {
                if (dotNetRef != null)
                {
                    return await _jsRuntime.InvokeAsync<TResult>($"{InteropPrefix}.{functionName}", data, dotNetRef);
                }
                else
                {
                    return await _jsRuntime.InvokeAsync<TResult>($"{InteropPrefix}.{functionName}", data);
                }
            }
            catch (JSException jsEx)
            {
                var exception = new IndexedDbException(
                    jsEx.Message,
                    "JSException",
                    null,
                    null);
                
                RaiseNotification(IndexDBActionOutCome.Failed, exception.Message);
                throw exception;
            }
        }

        private async Task<TResult> CallJavascript<TResult>(string functionName, params object[] args)
        {
            try
            {
                return await _jsRuntime.InvokeAsync<TResult>($"{InteropPrefix}.{functionName}", args);
            }
            catch (JSException jsEx)
            {
                var exception = new IndexedDbException(
                    jsEx.Message,
                    "JSException",
                    null,
                    null);
                
                RaiseNotification(IndexDBActionOutCome.Failed, exception.Message);
                throw exception;
            }
        }

        /// <summary>
        /// Ensures the database is open and sets the correct database context
        /// </summary>
        private async Task EnsureDbOpen()
        {
            if (!_isOpen || _currentDbName != _dbStore.DbName)
            {
                await OpenDb();
            }
        }

        private void RaiseNotification(IndexDBActionOutCome outcome, string message)
        {
            ActionCompleted?.Invoke(this, new IndexedDBNotificationArgs { Message = message, Outcome = outcome });
        }
        
        /// <summary>
        /// Called when the instance is disposed
        /// </summary>
        public async ValueTask DisposeAsync()
        {
            if (_dotNetRef != null)
            {
                _dotNetRef.Dispose();
                _dotNetRef = null;
            }
            await Task.CompletedTask;
        }
    }
}
