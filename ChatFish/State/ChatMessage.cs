namespace ChatFish.State;

public class ChatMessage
{
    public static readonly IReadOnlyDictionary<string, string> Commands = new Dictionary<string, string>
    {
        {"about", "Show the about page"},
        {"help", "Display this help"}
    };

    public static readonly IReadOnlyDictionary<string, string> Emotes = new Dictionary<string, string>
    {
        {"shout", "Shout a chat message"},
        {"whisper", "Whisper a chat message"}
    };

    public string Message { get; init; } = "";
    public string Modifier { get; init; } = "";

    public bool IsCommand => Commands.ContainsKey(Modifier);
    public bool IsEmpty => string.IsNullOrWhiteSpace(Message) && string.IsNullOrWhiteSpace(Modifier);

    public static ChatMessage FromMessage(string message)
    {
        message = message.Trim();

        if (message.StartsWith('/'))
        {
            // Format 2: /command argument
            var parts = message[1..].Split(' ', 2);
            var modifier = parts[0].ToLower();
            var messageText = parts.Length > 1 ? parts[1] : "";
            return new ChatMessage
            {
                Message = messageText,
                Modifier = modifier,
            };
        }

        return new ChatMessage
        {
            Message = message,
            Modifier = "",
        };
    }
}