using ChatFish.Components;
using ChatFish.State;

namespace ChatFish;

public class FishTankClient(ILogger<FishTankClient> logger)
{
    private readonly ILogger<FishTankClient> _logger = logger;
    private Dictionary<string, FishState> _fish = [];

    public string ClientConnectionId { get; private set; } = "user";
    public IReadOnlyCollection<FishState> Fish => _fish.Values;
    public bool IsOfflineMode { get; set; } = false;

    public event Action? OnStateChanged;

    private const int MessageDisplayDurationMS = 10000;

    public void Initialize()
    {
        try
        {
            _fish = new Dictionary<string, FishState>()
            {
                ["ai"] = new FishState { Id = "ai", Color = FishColor.Orange, Scale = "1.0" },
                [ClientConnectionId] = new FishState { Id = ClientConnectionId, Color = FishColor.Blue, Scale = "0.95" },
            };

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

    public event Action<FishMessage>? OnMessageReceived;

    public async Task SendMessageAsync(ChatMessage message)
    {
        // intentionally not awaited
        _ = DisplayMessageForFish(ClientConnectionId, message);

        await Task.CompletedTask;
        //if (_hubConnection is not null && !IsOfflineMode)
        //{
        //    await _hubConnection.SendAsync("BroadcastMessage", message);
        //}
        //else
        //{
        //    _logger.LogWarning("Cannot send message: not connected to hub");
        //}
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