namespace EnterpriseChatbot.API.Models.Domain;

public class AnalyticsOverview
{
    public AnalyticsSummary Summary { get; set; } = new();
    public IEnumerable<object> Trends { get; set; } = [];
    public IEnumerable<object> TopErrors { get; set; } = [];
}

public class AnalyticsSummary
{
    public int TotalSearches { get; set; }
    public int ActiveUsers { get; set; }
    public int ActiveTenants { get; set; }
    public int ResolvedSearches { get; set; }
    public double AvgResponseTime { get; set; }
    public DateTime? LastActivity { get; set; }
}
