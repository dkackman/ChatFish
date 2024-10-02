using Microsoft.JSInterop;

namespace ChatFish.Services;

public class LLMService(IJSRuntime JSRuntime)
{
    private readonly IJSRuntime _JSRuntime = JSRuntime;
    public const string DefaultModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    private string _selectedModel = DefaultModel;
    public string SelectedModel
    {
        get => _selectedModel;
        set
        {
            _selectedModel = value;

            // ok to not await this
            _ = _JSRuntime.InvokeVoidAsync("localStorage.setItem", "selectedModel", _selectedModel);

            SelectedModelChanged?.Invoke();
        }
    }

    public IEnumerable<string> AvailableModels { get; private set; } = [DefaultModel];
    public async Task OnInitializedAsync()
    {
        AvailableModels = await _JSRuntime.InvokeAsync<List<string>>("getAvailableModels");
        var storedModel = await _JSRuntime.InvokeAsync<string>("localStorage.getItem", "selectedModel");
        if (!string.IsNullOrEmpty(storedModel) && AvailableModels.Contains(storedModel))
        {
            // set the variable, not the property to avoid triggering the setter
            SelectedModel = storedModel;
        }
    }

    public event Action? SelectedModelChanged;
}