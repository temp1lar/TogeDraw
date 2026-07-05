using Whiteboard.Application.Boards.DTOs;

namespace Whiteboard.Application.Common.Interfaces;

public interface IImageUploadService
{
    Task<UploadedImageDto> UploadImageAsync(
        Guid boardId, 
        Guid userId, 
        Stream imageStream, 
        string fileName, 
        string contentType, 
        int width = 0, 
        int height = 0, 
        CancellationToken ct = default);
    
    Task DeleteImageAsync(string s3Key, CancellationToken ct = default);
}