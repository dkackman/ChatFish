using ChatFish.Components;
using ChatFish.State;

namespace ChatFish;

public class FishTankClient(ILogger<FishTankClient> logger) : IAsyncDisposable
{
    private IDisposable? _onReceiveFishStateSubscription;
    private IDisposable? _onReceiveMessageSubscription;
    private readonly ILogger<FishTankClient> _logger = logger;
    private IDictionary<string, FishState> _fish = new Dictionary<string, FishState>();

    public string ClientConnectionId { get; private set; } = string.Empty;
    public IReadOnlyCollection<FishState> Fish => (IReadOnlyCollection<FishState>)_fish.Values;
    public bool IsOfflineMode { get; set; } = false;

    public event Action? OnStateChanged;

    private const int MessageDisplayDurationMS = 10000;

    public async Task InitializeAsync(string hubUrl)
    {
        try
        {
            
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

    public async ValueTask DisposeAsync()
    {
        _onReceiveFishStateSubscription?.Dispose();
        _onReceiveMessageSubscription?.Dispose();

    }

    public event Action<FishMessage>? OnMessageReceived;

    public async Task SendMessageAsync(ChatMessage message)
    {
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