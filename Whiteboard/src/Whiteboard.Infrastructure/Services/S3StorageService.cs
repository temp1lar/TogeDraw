using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Whiteboard.Application.Common.Interfaces;

namespace Whiteboard.Infrastructure.Services;

public class S3StorageService : IS3StorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly ILogger<S3StorageService> _logger;

    public S3StorageService(
        IAmazonS3 s3Client,
        IConfiguration config,
        ILogger<S3StorageService> logger)
    {
        _s3Client = s3Client;
        _bucketName = config["S3:BucketName"] ?? "whiteboard";
        _logger = logger;
    }

    public async Task<string> UploadFileAsync(
        Stream fileStream, 
        string fileName, 
        string contentType, 
        string folder, 
        CancellationToken ct = default)
    {
        var key = $"{folder}/{Guid.NewGuid()}/{fileName}";

        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            InputStream = fileStream,
            ContentType = contentType,
            Metadata =
            {
                ["x-amz-meta-original-name"] = fileName
            }
        };

        await _s3Client.PutObjectAsync(request, ct);

        _logger.LogInformation("Uploaded file to S3: {Key}", key);

        return key;
    }

    public async Task<Stream?> DownloadFileAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var response = await _s3Client.GetObjectAsync(_bucketName, key, ct);
            return response.ResponseStream;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning("File not found in S3: {Key}", key);
            return null;
        }
    }

    public async Task DeleteFileAsync(string key, CancellationToken ct = default)
    {
        var request = new DeleteObjectRequest
        {
            BucketName = _bucketName,
            Key = key
        };

        await _s3Client.DeleteObjectAsync(request, ct);
        _logger.LogInformation("Deleted file from S3: {Key}", key);
    }

    public async Task<string> GetPresignedUrlAsync(
        string key, 
        int expirationMinutes = 60, 
        CancellationToken ct = default)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucketName,
            Key = key,
            Expires = DateTime.UtcNow.AddMinutes(expirationMinutes)
        };

        return await _s3Client.GetPreSignedURLAsync(request);
    }

    public async Task<bool> FileExistsAsync(string key, CancellationToken ct = default)
    {
        try
        {
            await _s3Client.GetObjectMetadataAsync(_bucketName, key, ct);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }
}