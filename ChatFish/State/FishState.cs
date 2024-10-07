using ChatFish.Components;

namespace ChatFish.State;

public class FishState : IDisposable
{
    private ChatMessage _currentMessage = new();
    private bool disposedValue;
    private CancellationTokenSource _messageCts = new();

    public string Id { get; init; } = string.Empty;
    public FishColor Color { get; init; } = FishColor.Orange;
    public string Scale { get; init; } = "100.0";
    public bool IsMessageVisible { get; private set; } = false;

    public ChatMessage CurrentMessage
    {
        get => _currentMessage;
        set
        {
            if (value != _currentMessage)
            {
                _currentMessage = value;
                OnMessageChanged();
            }
        }
    }

    private void OnMessageChanged()
    {
        IsMessageVisible = !_currentMessage.IsEmpty;
        MessageChanged?.Invoke();
    }

    public Action? MessageChanged;

    override public string ToString() => $"[Id: {Id}, Color: {Color}]";

    protected virtual void Dispose(bool disposing)
    {
        if (!disposedValue)
        {
            if (disposing)
            {
                _messageCts.Dispose();
            }

            disposedValue = true;
        }
    }

    public void Dispose()
    {
        // Do not change this code. Put cleanup code in 'Dispose(bool disposing)' method
        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }
}