
namespace TG.Blazor.IndexedDB
{
    public class DbInformation
    {
        public int Version { get; set; }
        public required string[] StoreNames { get; set; }
    }
}
