namespace ChatFish.State;

public class FishMessage
{
    public string ClientId { get; init; } = string.Empty;
    public ChatMessage Message { get; init; } = new();
    override public string ToString() => $"[Id: {ClientId}, Message: {Message.Message}]";
}