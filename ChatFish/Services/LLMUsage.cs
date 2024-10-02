namespace ChatFish.Services;

public class LLMUsage
{
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public double PrefillTokensPerSecond { get; set; }
    public double DecodeTokensPerSecond { get; set; }
}