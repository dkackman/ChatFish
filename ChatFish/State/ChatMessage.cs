namespace ChatFish.State;

public class ChatMessage
{
    // Modifier value for the transient "the model is thinking" bubble. It carries
    // no text of its own; MessageBubble renders an animated indicator instead.
    public const string ThinkingModifier = "thinking";

    public string Message { get; init; } = "";
    public string Modifier { get; init; } = "";

    // A live peek at a reasoning model's chain-of-thought, shown under the
    // thinking indicator. Only meaningful while IsThinking is true.
    public string Reasoning { get; init; } = "";

    public bool IsCommand => Commands.ContainsKey(Modifier);
    public bool IsThinking => Modifier == ThinkingModifier;
    public bool IsEmpty => string.IsNullOrWhiteSpace(Message) && string.IsNullOrWhiteSpace(Modifier);

    // A "thinking" bubble shown while awaiting the model's answer. The optional
    // reasoning is streamed underneath the animated indicator.
    public static ChatMessage Thinking(string reasoning = "") => new() { Modifier = ThinkingModifier, Reasoning = reasoning };

    // Wraps raw model output as a plain reply. Unlike FromMessage it does no
    // command/emote parsing, so a reply that happens to start with '/' is shown
    // verbatim rather than being misread as a command.
    public static ChatMessage FromReply(string reply) => new() { Message = reply };

    // Override Equals method
    public override bool Equals(object? obj) => Equals(obj as ChatMessage);

    // Implement IEquatable<ChatMessage>
    public bool Equals(ChatMessage? other)
    {
        if (other == null)
            return false;

        return Message == other.Message && Modifier == other.Modifier && Reasoning == other.Reasoning;
    }

    // Override GetHashCode method
    public override int GetHashCode() => HashCode.Combine(Message, Modifier, Reasoning);

    // Equality operator
    public static bool operator ==(ChatMessage? left, ChatMessage? right)
    {
        if (left is null)
            return right is null;

        return left.Equals(right);
    }

    // Inequality operator
    public static bool operator !=(ChatMessage? left, ChatMessage? right) => !(left == right);
    
    public static readonly IReadOnlyDictionary<string, string> Commands = new Dictionary<string, string>
    {
        {"about", "Show the about page"},
        {"help", "Display this help"},
        {"llm", "Configure the LLM"},
    };

    public static readonly IReadOnlyDictionary<string, string> Emotes = new Dictionary<string, string>
    {
        {"shout", "Shout a chat message"},
        {"whisper", "Whisper a chat message"},
    };

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