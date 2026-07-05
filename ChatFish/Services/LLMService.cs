using System.Diagnostics;
using Microsoft.JSInterop;
using ChatFish.State;

namespace ChatFish.Services;

public class LLMService(IJSRuntime JSRuntime, ILogger<LLMService> logger) : IDisposable
{
    private readonly List<LLMessage> _transcript = [
        new LLMessage
        {
            Content = "You are ChatFish, a friendly fish that loves to chat with people. You are the color orange",
            Role = "system",
        },
    ];

    private readonly IJSRuntime _JSRuntime = JSRuntime;
    private readonly ILogger<LLMService> _logger = logger;
    private string _selectedModel = DefaultModel;
    private DotNetObjectReference<LLMService>? _dotNetRef;

    public const string DefaultModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    public IEnumerable<string> AvailableModels { get; private set; } = [DefaultModel];

    // Ids of models already cached locally by web-llm. Refreshed from the browser
    // cache rather than tracked separately so it can't drift out of sync.
    public IReadOnlyCollection<string> DownloadedModels { get; private set; } = [];

    public bool IsModelDownloaded(string modelId) => DownloadedModels.Contains(modelId);

    // The model currently loaded in the web-llm engine, or null if none. Reflects
    // in-memory engine state, so it's distinct from whether a model is downloaded.
    public string? LoadedModel { get; private set; }

    public async Task RefreshDownloadedModels()
    {
        try
        {
            DownloadedModels = await _JSRuntime.InvokeAsync<List<string>>("getDownloadedModels");
        }
        catch (JSException ex)
        {
            _logger.LogWarning(ex, "Failed to query downloaded models.");
        }
    }

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

            await _JSRuntime.InvokeVoidAsync("sendLLMMessage", _transcript, _dotNetRef);
        }
    }

    [JSInvokable]
    public void OnMessageUpdate(string curMessage) => MessageUpdate?.Invoke(curMessage);

    [JSInvokable]
    public void OnMessageFinish(string finalMessage)
    {
        // Persist only the answer in history. A reasoning model's <think> chain-
        // of-thought must not be replayed into later turns: it bloats the context
        // window and these models are trained to condition on prior answers only.
        var answer = ReasoningParser.Parse(finalMessage).Answer;
        var chatMessage = new LLMessage
        {
            Content = answer,
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
        await RefreshDownloadedModels();

        // localStorage returns null on first visit; only restore a previously saved
        // model so we don't log a spurious "Invalid model selected" warning.
        var savedModel = await _JSRuntime.InvokeAsync<string?>("localStorage.getItem", "selectedModel");
        if (!string.IsNullOrEmpty(savedModel))
        {
            SelectedModel = savedModel;
        }
    }

    public async Task InitializeWebLLMEngine()
    {
        Debug.Assert(_dotNetRef is not null);

        try
        {
            await _JSRuntime.InvokeVoidAsync("resetLLMEngine", _dotNetRef);
            LoadedModel = null;
            UpdateEngineInitProgress("Initializing WebLLM engine...", 0);
            LoadedModel = await _JSRuntime.InvokeAsync<string?>("initializeWebLLMEngine", SelectedModel, _dotNetRef);
        }
        catch (JSException ex)
        {
            UpdateEngineInitProgress(ex.Message, 0);
        }
    }

    [JSInvokable]
    public void UpdateEngineInitProgress(string text, double progress) => UpdateEngineInitProgressChanged?.Invoke(text, progress);

    public event Action? SelectedModelChanged;
    public event Action<string, double>? UpdateEngineInitProgressChanged;

    public void Dispose() => _dotNetRef?.Dispose();
}
