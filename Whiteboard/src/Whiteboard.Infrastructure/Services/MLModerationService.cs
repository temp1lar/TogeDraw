using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Whiteboard.Application.Common.Interfaces;
using Whiteboard.Application.Common.Models;

namespace Whiteboard.Infrastructure.Services;

public class MLModerationService : IMLModerationService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<MLModerationService> _logger;
    private readonly string _mlServiceUrl;

    public MLModerationService(
        HttpClient httpClient,
        ILogger<MLModerationService> logger,
        IConfiguration config)
    {
        _httpClient = httpClient;
        _logger = logger;
        _mlServiceUrl = config["MLService:Url"] ?? "http://localhost:8000";
    }

    public async Task<ModerationResult> CheckDrawingAsync(List<List<List<float>>> strokes)
    {
        try
        {
            var request = new DrawingRequest(strokes);
            
            var response = await _httpClient.PostAsJsonAsync(
                $"{_mlServiceUrl}/moderate", 
                request);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("ML service returned {StatusCode}", response.StatusCode);
                return new ModerationResult(
                    IsSafe: true,
                    Confidence: 0,
                    ViolationType: null,
                    ProbabilityUnsafe: 0
                );
            }

            var result = await response.Content.ReadFromJsonAsync<ModerationResultDto>();
            
            _logger.LogInformation(
                "ML moderation: IsSafe={IsSafe}, Confidence={Confidence}, ProbUnsafe={ProbUnsafe}",
                result?.IsSafe, result?.Confidence, result?.ProbabilityUnsafe);

            return new ModerationResult(
                IsSafe: result?.IsSafe ?? true,
                Confidence: result?.Confidence ?? 0,
                ViolationType: result?.IsSafe == false ? "Inappropriate content" : null,
                ProbabilityUnsafe: result?.ProbabilityUnsafe ?? 0
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check drawing with ML service");
            return new ModerationResult(
                IsSafe: true,
                Confidence: 0,
                ViolationType: null,
                ProbabilityUnsafe: 0
            );
        }
    }
}