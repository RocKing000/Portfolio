using Minio;
using Minio.DataModel.Args;

namespace DocumentService.Services;

public interface IDocumentStore
{
    Task<string> UploadAsync(string bucket, string key, Stream content, long size, string contentType, CancellationToken ct = default);
    Task<Stream> DownloadAsync(string bucket, string key, CancellationToken ct = default);
    Task<bool> ExistsAsync(string bucket, string key, CancellationToken ct = default);
    Task EnsureBucketAsync(string bucket, CancellationToken ct = default);
}

public class MinioDocumentStore(Infrastructure.IMinioClientFactory factory) : IDocumentStore
{
    public async Task<string> UploadAsync(
        string bucket, string key, Stream content, long size,
        string contentType, CancellationToken ct = default)
    {
        var client = factory.Create();
        await EnsureBucketAsync(bucket, ct);

        await client.PutObjectAsync(new PutObjectArgs()
            .WithBucket(bucket)
            .WithObject(key)
            .WithStreamData(content)
            .WithObjectSize(size)
            .WithContentType(contentType), ct);

        return key;
    }

    public async Task<Stream> DownloadAsync(string bucket, string key, CancellationToken ct = default)
    {
        var client  = factory.Create();
        var ms      = new MemoryStream();

        await client.GetObjectAsync(new GetObjectArgs()
            .WithBucket(bucket)
            .WithObject(key)
            .WithCallbackStream(stream => stream.CopyTo(ms)), ct);

        ms.Position = 0;
        return ms;
    }

    public async Task<bool> ExistsAsync(string bucket, string key, CancellationToken ct = default)
    {
        try
        {
            var client = factory.Create();
            await client.StatObjectAsync(new StatObjectArgs()
                .WithBucket(bucket)
                .WithObject(key), ct);
            return true;
        }
        catch (Minio.Exceptions.ObjectNotFoundException)
        {
            return false;
        }
    }

    public async Task EnsureBucketAsync(string bucket, CancellationToken ct = default)
    {
        var client = factory.Create();
        var exists = await client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(bucket), ct);

        if (!exists)
            await client.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucket), ct);
    }
}
