using Microsoft.Data.SqlClient;

namespace AuditService.Infrastructure;

public interface IDbConnectionFactory
{
    SqlConnection Create();
}

public class SqlConnectionFactory(string connectionString) : IDbConnectionFactory
{
    public SqlConnection Create() => new(connectionString);
}

public interface IRabbitMQConsumerFactory
{
    RabbitMQ.Client.IConnection Create();
}

public class RabbitMQConsumerFactory(string url) : IRabbitMQConsumerFactory
{
    public RabbitMQ.Client.IConnection Create()
    {
        var factory = new RabbitMQ.Client.ConnectionFactory { Uri = new Uri(url) };
        return factory.CreateConnection();
    }
}
