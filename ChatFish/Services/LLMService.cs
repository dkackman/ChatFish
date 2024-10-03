using System.Diagnostics;
using Microsoft.JSInterop;

namespace ChatFish.Services;

public class LLMService(IJSRuntime JSRuntime, ILogger<LLMService> logger) : IDisposable
{
    private readonly List<LLMessage> _transcript = [
        new LLMessage
        {
            Content = "You are ChatFish, a friendly fish that loves to chat with people. You are the color blue",
            Role = "system",
        },
    ];

    private readonly IJSRuntime _JSRuntime = JSRuntime;
    private readonly ILogger<LLMService> _logger = logger;
    private string _selectedModel = DefaultModel;
    private DotNetObjectReference<LLMService>? _dotNetRef;

    public const string DefaultModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    public IEnumerable<string> AvailableModels { get; private set; } = [DefaultModel];

    public string SelectedModel
    {
        get => _selectedModel;
        set
        {
            if (!string.IsNullOrEmpty(value) && AvailableModels.Contains(value))
            {
                _selectedModel = value;
                // ok to not await this
                _ = _JSRuntime.InvokeVoidAsync("localStorage.setItem", "selectedModel", _selectedModel);

                SelectedModelChanged?.Invoke();
            }
            else
            {
                _logger.LogWarning("Invalid model selected: {Model}", value);
            }
        }
    }

    public event Action<string>? MessageUpdate;
    public event Action<string>? MessageFinish;
    public event Action<string>? MessageError;

    public async Task SendMessage(string message)
    {
        message = message.Trim();
        if (!string.IsNullOrWhiteSpace(message))
        {
            var chatMessage = new LLMessage
            {
                Content = message,
                Role = "user",
            };

            _transcript.Add(chatMessage);

            try
            {
                await _JSRuntime.InvokeVoidAsync("sendLLMMessage", _transcript, _dotNetRef);
            }
            catch (JSException ex)
            {
                _logger.LogError(ex, "Error sending message: {Message}", message);
                MessageError?.Invoke(ex.Message);
            }
        }
    }

    [JSInvokable]
    public void OnMessageUpdate(string curMessage)
    {
        MessageUpdate?.Invoke(curMessage);
    }

    [JSInvokable]
    public void OnMessageFinish(string finalMessage)
    {
        var chatMessage = new LLMessage
        {
            Content = finalMessage,
            Role = "assistant",
        };
        _transcript.Add(chatMessage);
        MessageFinish?.Invoke(finalMessage);
    }

    [JSInvokable]
    public void OnMessageError(string error)
    {
        _logger.LogError("LLM error: {Error}", error);
        MessageError?.Invoke(error);
    }

    public async Task OnInitializedAsync()
    {
        Debug.Assert(_dotNetRef is null);
        _dotNetRef = DotNetObjectReference.Create(this);
        AvailableModels = await _JSRuntime.InvokeAsync<List<string>>("getAvailableModels");
        SelectedModel = await _JSRuntime.InvokeAsync<string>("localStorage.getItem", "selectedModel");
    }

    public async Task InitializeWebLLMEngine()
    {
        Debug.Assert(_dotNetRef is not null);

        try
        {
            UpdateEngineInitProgress("Initializing WebLLM engine...", 0);
            await _JSRuntime.InvokeVoidAsync("initializeWebLLMEngine", SelectedModel, _dotNetRef);
        }
        catch (JSException ex)
        {
            UpdateEngineInitProgress(ex.Message, 0);
        }
    }

    [JSInvokable]
    public void UpdateEngineInitProgress(string text, double progress)
    {
        UpdateEngineInitProgressChanged?.Invoke(text, progress);
    }

    public event Action? SelectedModelChanged;
    public event Action<string, double>? UpdateEngineInitProgressChanged;

    public void Dispose()
    {
        _dotNetRef?.Dispose();
    }
}
