using ChatFish.Services;
using ChatFish.Components;
using ChatFish.State;

namespace ChatFish;

public class FishTankClient(LLMService llmService, ILogger<FishTankClient> logger)
{
    private readonly LLMService _llmService = llmService;
    private readonly ILogger<FishTankClient> _logger = logger;
    private Dictionary<string, FishState> _fish = [];

    public string ClientConnectionId { get; private set; } = "user";
    public IReadOnlyCollection<FishState> Fish => _fish.Values;
    public bool IsOfflineMode { get; set; } = false;

    public event Action? OnStateChanged;

    private const int MessageDisplayDurationMS = 30000;

    public void Initialize()
    {
        try
        {
            _fish = new Dictionary<string, FishState>()
            {
                ["ai"] = new FishState { Id = "ai", Color = FishColor.Orange, Scale = "1.0" },
                [ClientConnectionId] = new FishState { Id = ClientConnectionId, Color = FishColor.Blue, Scale = "0.95" },
            };
            _llmService.MessageFinish += OnMessageUpdate;
            _llmService.MessageFinish += OnMessageReceived;
            IsOfflineMode = false;
            _logger.LogDebug("ClientId connected: {ClientConnectionId}", ClientConnectionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to the hub. Working in offline mode.");
            IsOfflineMode = true;
            ClientConnectionId = "offline1";
            // Initialize with some default fish for offline mode
            _fish = new Dictionary<string, FishState>()
            {
                ["offline1"] = new FishState { Id = ClientConnectionId, Color = FishColor.Orange, Scale = "1.0" },
            };
        }
        finally
        {
            OnStateChanged?.Invoke();
        }
    }

    public async Task SendMessageAsync(ChatMessage message)
    {
        // intentionally not awaited
        _ = DisplayMessageForFish(ClientConnectionId, message);
        try
        {
            await _llmService.SendMessage(message.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send message to the hub.");
            _ = DisplayMessageForFish("ai", ChatMessage.FromMessage("Make sure to select and download a model first."));
        }
    }

    private void OnMessageUpdate(string message)
    {
        if (_fish.TryGetValue("ai", out var fish))
        {
            fish.CurrentMessage = ChatMessage.FromMessage(message);
            fish.IsMessageVisible = true;
            OnStateChanged?.Invoke();
        }
    }

    private void OnMessageReceived(string message)
    {
        _ = DisplayMessageForFish("ai", ChatMessage.FromMessage(message));
    }

    private async Task DisplayMessageForFish(string fishId, ChatMessage message)
    {
        _logger.LogDebug("Received message from: {fishId}", fishId);

        if (_fish.TryGetValue(fishId, out var fish))
        {
            fish.CurrentMessage = message;
            fish.IsMessageVisible = true;
            OnStateChanged?.Invoke();

            await Task.Delay(MessageDisplayDurationMS);

            fish.CurrentMessage = new();
            fish.IsMessageVisible = false;
            OnStateChanged?.Invoke();
        }
    }
}