using System;

namespace TG.Blazor.IndexedDB
{

    public class IndexedDBNotificationArgs : EventArgs
    {
        public IndexDBActionOutCome Outcome { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public enum IndexDBActionOutCome
    {
        Successful = 0,
        Failed = 1,
        Deleted = 2
    }
}