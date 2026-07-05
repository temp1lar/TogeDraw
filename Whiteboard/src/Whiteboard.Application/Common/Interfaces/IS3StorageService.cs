namespace Whiteboard.Application.Common.Interfaces;

public interface IS3StorageService
{
    Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string folder, CancellationToken ct = default);
    Task<Stream?> DownloadFileAsync(string key, CancellationToken ct = default);
    Task DeleteFileAsync(string key, CancellationToken ct = default);
    Task<string> GetPresignedUrlAsync(string key, int expirationMinutes = 60, CancellationToken ct = default);
    Task<bool> FileExistsAsync(string key, CancellationToken ct = default);
}