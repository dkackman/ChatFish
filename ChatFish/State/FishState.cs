using ChatFish.Components;
using System.Timers;

namespace ChatFish.State;

public class FishState : IDisposable
{
    private const int MessageVisibilityDurationMS = 25000;
    private readonly object _lock = new();
    private ChatMessage _currentMessage = new();
    private readonly System.Timers.Timer _messageTimer = new(MessageVisibilityDurationMS);

    public string Id { get; init; } = string.Empty;
    public FishColor Color { get; init; } = FishColor.Orange;
    public string Scale { get; init; } = "100.0";

    public bool IsMessageVisible { get; private set; } = false;

    public event Action? MessageChanged;

    public FishState()
    {
        _messageTimer.Elapsed += OnMessageTimerElapsed;
        _messageTimer.AutoReset = false;
    }

    public ChatMessage CurrentMessage
    {
        get
        {
            lock (_lock)
            {
                return _currentMessage;
            }
        }
        set
        {
            lock (_lock)
            {
                if (value != _currentMessage)
                {
                    _currentMessage = value;
                    IsMessageVisible = !_currentMessage.IsEmpty;
                    MessageChanged?.Invoke();

                    _messageTimer.Stop();
                    if (IsMessageVisible)
                    {
                        _messageTimer.Start();
                    }
                }
            }
        }
    }

    private void OnMessageTimerElapsed(object? sender, ElapsedEventArgs e)
    {
        lock (_lock)
        {
            IsMessageVisible = false;
            MessageChanged?.Invoke();
        }
    }

    public void Dispose() => _messageTimer.Dispose();
}