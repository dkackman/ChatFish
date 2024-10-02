namespace ChatFish.Services;

public record LLMessage
{
    public string Content { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
}