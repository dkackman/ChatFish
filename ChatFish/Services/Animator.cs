using ChatFish.Components;
using System.Timers;
using Microsoft.JSInterop;

namespace ChatFish.Services;

public class Animator : IDisposable
{
    private readonly System.Timers.Timer _animationTimer = new(50) { AutoReset = true, Enabled = false };
    private readonly IJSRuntime _JSRuntime;
    private bool disposedValue;

    public Animator(IJSRuntime JSRuntime)
    {
        _JSRuntime = JSRuntime;
        _animationTimer.Start();
        _animationTimer.Elapsed += OnTimerElapsedAsync;
    }

    private async void OnTimerElapsedAsync(object? sender, ElapsedEventArgs e)
    {
        var tankRect = await _JSRuntime.InvokeAsync<ClientRect>("getTankRect");
        OnAnimationTick?.Invoke(tankRect);
    }

    public event Action<ClientRect>? OnAnimationTick;

    protected virtual void Dispose(bool disposing)
    {
        if (!disposedValue)
        {
            if (disposing)
            {
                _animationTimer.Stop();
                _animationTimer.Elapsed -= OnTimerElapsedAsync;
                _animationTimer.Dispose();
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