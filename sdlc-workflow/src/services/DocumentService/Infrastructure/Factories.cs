using Microsoft.Data.SqlClient;
using Minio;

namespace DocumentService.Infrastructure;

public interface IDbConnectionFactory
{
    SqlConnection Create();
}

public class SqlConnectionFactory(string connectionString) : IDbConnectionFactory
{
    public SqlConnection Create() => new(connectionString);
}

public interface IMinioClientFactory
{
    IMinioClient Create();
}

public class MinioClientFactory(string endpoint, string accessKey, string secretKey, bool useSSL) : IMinioClientFactory
{
    public IMinioClient Create() =>
        new MinioClient()
            .WithEndpoint(endpoint)
            .WithCredentials(accessKey, secretKey)
            .WithSSL(useSSL)
            .Build();
}
