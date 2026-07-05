using Microsoft.Extensions.Logging;
using Whiteboard.Application.Boards.DTOs;
using Whiteboard.Application.Common.Interfaces;

namespace Whiteboard.Infrastructure.Services;

public class ImageUploadService : IImageUploadService
{
    private readonly IS3StorageService _s3Service;
    private readonly ILogger<ImageUploadService> _logger;

    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"
    };

    public ImageUploadService(
        IS3StorageService s3Service,
        ILogger<ImageUploadService> logger)
    {
        _s3Service = s3Service;
        _logger = logger;
    }

    public async Task<UploadedImageDto> UploadImageAsync(
        Guid boardId, 
        Guid userId, 
        Stream imageStream, 
        string fileName, 
        string contentType, 
        int width = 0, 
        int height = 0,    
        CancellationToken ct = default)
    {
        ValidateImage(contentType, imageStream);

        // Копируем stream
        using var memoryStream = new MemoryStream();
        await imageStream.CopyToAsync(memoryStream, ct);
        memoryStream.Position = 0;

        // Загружаем в S3
        var folder = $"boards/{boardId}/images";
        var s3Key = await _s3Service.UploadFileAsync(memoryStream, fileName, contentType, folder, ct);

        // Получаем presigned URL
        var presignedUrl = await _s3Service.GetPresignedUrlAsync(s3Key, expirationMinutes: 60, ct);

        _logger.LogInformation(
            "User {UserId} uploaded image to board {BoardId}: {S3Key} ({Width}x{Height})",
            userId, boardId, s3Key, width, height);

        return new UploadedImageDto(
            ElementId: Guid.NewGuid(),
            S3Key: s3Key,
            FileName: fileName,
            ContentType: contentType,
            SizeBytes: memoryStream.Length,
            Width: width,
            Height: height,
            PresignedUrl: presignedUrl
        );
    }

    public async Task DeleteImageAsync(string s3Key, CancellationToken ct = default)
    {
        await _s3Service.DeleteFileAsync(s3Key, ct);
        _logger.LogInformation("Deleted image from S3: {S3Key}", s3Key);
    }

    private void ValidateImage(string contentType, Stream stream)
    {
        if (!AllowedContentTypes.Contains(contentType))
            throw new InvalidOperationException($"Invalid content type: {contentType}. Allowed: {string.Join(", ", AllowedContentTypes)}");

        if (stream.Length > MaxFileSizeBytes)
            throw new InvalidOperationException($"File too large. Max size: {MaxFileSizeBytes / 1024 / 1024} MB");

        if (stream.Length == 0)
            throw new InvalidOperationException("File is empty");
    }
}