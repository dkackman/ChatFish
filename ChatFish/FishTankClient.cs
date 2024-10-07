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
        _llmService.MessageFinish += OnMessageReceived;

        OnStateChanged?.Invoke();
    }

    public async Task SendMessageAsync(ChatMessage message)
    {
        DisplayMessageForFish(ClientConnectionId, message);
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

    private void OnMessageReceived(string message) => DisplayMessageForFish("ai", ChatMessage.FromMessage(message));

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
        _llmService.MessageFinish -= OnMessageReceived;
    }
}