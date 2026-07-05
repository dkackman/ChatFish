using ChatFish.Services;
using ChatFish.Components;
using ChatFish.State;

namespace ChatFish;

public class FishTankClient(LLMService llmService, ILogger<FishTankClient> logger) : IDisposable
{
    private readonly LLMService _llmService = llmService;
    private readonly ILogger<FishTankClient> _logger = logger;
    private Dictionary<string, FishState> _fish = [];

    public string ClientConnectionId { get; private set; } = "user";
    public IReadOnlyCollection<FishState> Fish => _fish.Values;
    public bool IsOfflineMode { get; set; } = false;

    public event Action? OnStateChanged;

    public void Initialize()
    {
        _fish = new Dictionary<string, FishState>()
        {
            ["ai"] = new FishState { Id = "ai", Color = FishColor.Orange, Scale = "1.0" },
            [ClientConnectionId] = new FishState { Id = ClientConnectionId, Color = FishColor.Blue, Scale = "0.9" },
        };
        _llmService.MessageUpdate += OnMessageStreaming;
        _llmService.MessageFinish += OnMessageReceived;
        _llmService.MessageError += OnMessageError;

        OnStateChanged?.Invoke();
    }

    public async Task SendMessageAsync(ChatMessage message)
    {
        DisplayMessageForFish(ClientConnectionId, message);
        // Show the animated "thinking" bubble immediately; it stays until the
        // first streamed token replaces it (or an error clears it).
        DisplayMessageForFish("ai", ChatMessage.Thinking());
        try
        {
            await _llmService.SendMessage(message.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send chat message.");
            DisplayMessageForFish("ai", ChatMessage.FromMessage("Make sure to select and download a model first."));
        }
    }

    // Partial reply streamed token-by-token. Reasoning models stream a
    // <think>...</think> chain-of-thought before the answer; while that is still
    // arriving we keep the animated thinking bubble and let its peek follow the
    // live reasoning, only switching to the answer once real answer text appears.
    private void OnMessageStreaming(string partial)
    {
        var parsed = ReasoningParser.Parse(partial);
        if (parsed.IsReasoning)
        {
            DisplayMessageForFish("ai", ChatMessage.Thinking(ReasoningParser.Peek(parsed.Reasoning)));
        }
        else if (!string.IsNullOrWhiteSpace(parsed.Answer))
        {
            DisplayMessageForFish("ai", ChatMessage.FromReply(parsed.Answer));
        }
        // else: answer hasn't started yet (e.g. just past </think>) — leave the
        // thinking bubble in place rather than flashing it blank.
    }

    // Final reply. Show only the answer (reasoning was transient), and fall back
    // to a note if the model returned nothing so the turn doesn't silently vanish.
    private void OnMessageReceived(string message)
    {
        var answer = ReasoningParser.Parse(message).Answer;
        DisplayMessageForFish("ai", ChatMessage.FromReply(
            string.IsNullOrWhiteSpace(answer) ? "🫧 (I didn't have anything to say — try again?)" : answer));
    }

    private void OnMessageError(string error) => DisplayMessageForFish("ai", ChatMessage.FromReply(error));

    private void DisplayMessageForFish(string fishId, ChatMessage message)
    {
        _logger.LogDebug("Received message from: {fishId}", fishId);

        if (_fish.TryGetValue(fishId, out var fish))
        {
            fish.CurrentMessage = message;
        }
    }

    public void Dispose()
    {
        _llmService.MessageUpdate -= OnMessageStreaming;
        _llmService.MessageFinish -= OnMessageReceived;
        _llmService.MessageError -= OnMessageError;
    }
}