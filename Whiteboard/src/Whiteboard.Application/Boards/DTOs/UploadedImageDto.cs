namespace Whiteboard.Application.Boards.DTOs;

public record UploadedImageDto(
    Guid ElementId,
    string S3Key,
    string FileName,
    string ContentType,
    long SizeBytes,
    int Width,
    int Height,
    string PresignedUrl
);