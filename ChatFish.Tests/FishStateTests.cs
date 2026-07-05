using ChatFish.Components;
using ChatFish.State;

namespace ChatFish.Tests;

public class FishStateTests
{
    [Fact]
    public void NewState_StartsEmptyAndHidden()
    {
        using var state = new FishState { Id = "ai", Color = FishColor.Orange, Scale = "1.0" };

        Assert.False(state.IsMessageVisible);
        Assert.True(state.CurrentMessage.IsEmpty);
        Assert.Equal("ai", state.Id);
        Assert.Equal(FishColor.Orange, state.Color);
        Assert.Equal("1.0", state.Scale);
    }

    [Fact]
    public void SettingMessage_MakesItVisibleAndRaisesEvent()
    {
        using var state = new FishState();
        var changes = 0;
        state.MessageChanged += () => changes++;

        state.CurrentMessage = ChatMessage.FromMessage("hello");

        Assert.True(state.IsMessageVisible);
        Assert.Equal("hello", state.CurrentMessage.Message);
        Assert.Equal(1, changes);
    }

    [Fact]
    public void SettingEqualMessage_DoesNotRaiseEventAgain()
    {
        using var state = new FishState();
        state.CurrentMessage = ChatMessage.FromMessage("hello");

        var changes = 0;
        state.MessageChanged += () => changes++;

        // an equal value must be ignored so subscribers aren't churned needlessly
        state.CurrentMessage = ChatMessage.FromMessage("hello");

        Assert.Equal(0, changes);
    }

    [Fact]
    public void ClearingMessage_HidesItAndRaisesEvent()
    {
        using var state = new FishState();
        state.CurrentMessage = ChatMessage.FromMessage("hello");

        var changes = 0;
        state.MessageChanged += () => changes++;

        state.CurrentMessage = new ChatMessage(); // empty, differs from "hello"

        Assert.False(state.IsMessageVisible);
        Assert.Equal(1, changes);
    }

    [Fact]
    public void Dispose_IsIdempotent()
    {
        var state = new FishState();

        state.Dispose();
        state.Dispose(); // must not throw
    }
}
