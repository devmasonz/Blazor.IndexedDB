using System;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace TG.Blazor.IndexedDB
{
    public static class ServiceCollectionExtensions
    {
        /// <summary>
        /// Set up the DbStore and creates an instance IndexedDBManager as a singleton
        /// </summary>
        /// <param name="services"></param>
        /// <param name="options">Action to set up the DbStore</param>
        /// <param name="storeName"></param>
        /// <returns></returns>
        public static IServiceCollection AddIndexedDB(this IServiceCollection services, Action<DbStore> options, string storeName)
        {
            var dbStore = new DbStore() { DbName = storeName };
            options(dbStore);

            services.TryAddSingleton(dbStore);
            services.AddScoped<IndexedDBManager , IndexedDBManager>();

            return services;
        }
    }
}
