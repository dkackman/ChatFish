using ChatFish.State;

namespace ChatFish.Tests;

public class ReasoningParserTests
{
    [Fact]
    public void PlainText_IsTheAnswer_WithNoReasoning()
    {
        var result = ReasoningParser.Parse("The answer is 4.");
        Assert.False(result.IsReasoning);
        Assert.Equal("The answer is 4.", result.Answer);
        Assert.Equal("", result.Reasoning);
    }

    [Fact]
    public void OpenThinkBlock_MidStream_IsReasoningWithNoAnswer()
    {
        var result = ReasoningParser.Parse("<think>Okay, the user wants the sum");
        Assert.True(result.IsReasoning);
        Assert.Equal("", result.Answer);
        Assert.Equal("Okay, the user wants the sum", result.Reasoning);
    }

    [Fact]
    public void ClosedThinkBlock_SplitsReasoningFromAnswer()
    {
        var result = ReasoningParser.Parse("<think>2 plus 2 is 4.</think>\n\nThe answer is 4.");
        Assert.False(result.IsReasoning);
        Assert.Equal("2 plus 2 is 4.", result.Reasoning);
        Assert.Equal("The answer is 4.", result.Answer);
    }

    [Fact]
    public void ClosedThinkBlock_WithoutOpenTag_TreatsLeadingTextAsReasoning()
    {
        // Some templates prefill the opening <think>, so only the close streams.
        var result = ReasoningParser.Parse("reasoning here</think>the answer");
        Assert.False(result.IsReasoning);
        Assert.Equal("reasoning here", result.Reasoning);
        Assert.Equal("the answer", result.Answer);
    }

    [Fact]
    public void JustClosedThinkBlock_HasNoAnswerYet()
    {
        // Right after </think> the answer hasn't streamed; answer is empty so the
        // caller keeps showing the thinking bubble rather than a blank one.
        var result = ReasoningParser.Parse("<think>done thinking</think>");
        Assert.False(result.IsReasoning);
        Assert.Equal("", result.Answer);
    }

    [Fact]
    public void Peek_ReturnsTailOfLongReasoning()
    {
        var reasoning = new string('a', 100) + "TAIL";
        var peek = ReasoningParser.Peek(reasoning, maxLength: 10);
        Assert.Equal("…aaaaaaTAIL", peek);
    }

    [Fact]
    public void Peek_ShortReasoning_ReturnedWhole()
    {
        Assert.Equal("short thought", ReasoningParser.Peek("  short thought  ", maxLength: 180));
    }
}
