namespace ChatFish.State;

// Reasoning models (e.g. DeepSeek-R1 distills) stream their chain-of-thought
// wrapped in <think>...</think> before the actual answer, all in one content
// stream. This splits an accumulated stream into the reasoning (shown as a live
// "thinking" peek) and the answer (shown as the reply).
public static class ReasoningParser
{
    private const string OpenTag = "<think>";
    private const string CloseTag = "</think>";

    public readonly record struct Result(string Reasoning, string Answer, bool IsReasoning);

    public static Result Parse(string? content)
    {
        content ??= "";

        var closeIdx = content.IndexOf(CloseTag, StringComparison.Ordinal);
        if (closeIdx >= 0)
        {
            // Reasoning is complete; everything after </think> is the answer.
            var reasoning = StripOpenTag(content[..closeIdx]).Trim();
            var answer = content[(closeIdx + CloseTag.Length)..].TrimStart();
            return new Result(reasoning, answer, IsReasoning: false);
        }

        var openIdx = content.IndexOf(OpenTag, StringComparison.Ordinal);
        if (openIdx >= 0)
        {
            // Mid-reasoning: no closing tag yet, so there is no answer to show.
            var reasoning = content[(openIdx + OpenTag.Length)..].Trim();
            return new Result(reasoning, "", IsReasoning: true);
        }

        // No reasoning markup at all: an ordinary model, or an answer-only stream.
        return new Result("", content, IsReasoning: false);
    }

    // Only the tail of the (possibly very long) chain-of-thought, so the bubble
    // reads as a single live, moving thought rather than a growing wall of text.
    public static string Peek(string reasoning, int maxLength = 180)
    {
        reasoning = reasoning.Trim();
        return reasoning.Length <= maxLength ? reasoning : "…" + reasoning[^maxLength..];
    }

    private static string StripOpenTag(string reasoning)
    {
        var openIdx = reasoning.IndexOf(OpenTag, StringComparison.Ordinal);
        return openIdx >= 0 ? reasoning[(openIdx + OpenTag.Length)..] : reasoning;
    }
}
