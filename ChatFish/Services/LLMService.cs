using Microsoft.JSInterop;

namespace ChatFish.Services;

public class LLMService(IJSRuntime JSRuntime, ILogger<LLMService> logger) : IDisposable
{
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

    public async Task OnInitializedAsync()
    {
        System.Diagnostics.Debug.Assert(_dotNetRef is null);
        _dotNetRef = DotNetObjectReference.Create(this);
        AvailableModels = await _JSRuntime.InvokeAsync<List<string>>("getAvailableModels");
        SelectedModel = await _JSRuntime.InvokeAsync<string>("localStorage.getItem", "selectedModel");
    }

    public async Task InitializeWebLLMEngine()
    {
        System.Diagnostics.Debug.Assert(_dotNetRef is not null);

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
    public event Action<string>? ChatMessageReceived;

    public void Dispose()
    {
        _dotNetRef?.Dispose();
    }
}