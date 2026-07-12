using Microsoft.Data.SqlClient;
using Minio;
using StackExchange.Redis;

namespace SessionService.Infrastructure;

public interface IDbConnectionFactory
{
    SqlConnection Create();
}

public class SqlConnectionFactory(string connectionString) : IDbConnectionFactory
{
    public SqlConnection Create() => new(connectionString);
}

public interface IRedisConnectionFactory
{
    IConnectionMultiplexer Get();
}

public class RedisConnectionFactory(string url) : IRedisConnectionFactory
{
    private readonly Lazy<IConnectionMultiplexer> _connection =
        new(() => ConnectionMultiplexer.Connect(url));

    public IConnectionMultiplexer Get() => _connection.Value;
}

public interface IRabbitMQConnectionFactory
{
    RabbitMQ.Client.IConnection Create();
}

public class RabbitMQConnectionFactory(string url) : IRabbitMQConnectionFactory
{
    public RabbitMQ.Client.IConnection Create()
    {
        var factory = new RabbitMQ.Client.ConnectionFactory { Uri = new Uri(url) };
        return factory.CreateConnection();
    }
}

public interface IMinioClientFactory
{
    IMinioClient Create();
}

public class MinioClientFactory(string endpoint, string accessKey, string secretKey)
    : IMinioClientFactory
{
    public IMinioClient Create() =>
        new MinioClient()
            .WithEndpoint(endpoint)
            .WithCredentials(accessKey, secretKey)
            .Build();
}
