using Ganss.Xss;

namespace ChatFish.Tests;

// Evidence for the "blank bubble with DeepSeek" bug: DeepSeek (a reasoning model)
// streams its chain-of-thought wrapped in <think>...</think>. These tests pin down
// exactly what the default HtmlSanitizer does with that markup.
public class SanitizerReasoningTests
{
    private readonly HtmlSanitizer _sanitizer = new();

    [Fact]
    public void ClosedThinkBlock_IsRemovedEntirely_LeavingOnlyTheAnswer()
    {
        var raw = "<think>Let me work this out. 2+2 is 4.</think>\n\nThe answer is 4.";
        var result = _sanitizer.Sanitize(raw);
        // The reasoning text vanishes with the tag; only the answer survives.
        Assert.DoesNotContain("work this out", result);
        Assert.Contains("The answer is 4.", result);
    }

    [Fact]
    public void UnclosedThinkBlock_MidStream_SanitizesToEmpty()
    {
        // During the (often long) reasoning phase, the streamed partial is an
        // unclosed <think> block. This is what shows up as a blank bubble.
        var midStream = "<think>Okay, the user is asking about";
        var result = _sanitizer.Sanitize(midStream);
        Assert.Equal("", result.Trim());
    }
}
