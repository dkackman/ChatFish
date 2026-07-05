using ChatFish.State;

namespace ChatFish.Tests;

public class ChatMessageTests
{
    [Fact]
    public void PlainText_HasNoModifier()
    {
        var message = ChatMessage.FromMessage("hello there");

        Assert.Equal("hello there", message.Message);
        Assert.Equal("", message.Modifier);
        Assert.False(message.IsCommand);
        Assert.False(message.IsEmpty);
    }

    [Fact]
    public void PlainText_IsTrimmed()
    {
        var message = ChatMessage.FromMessage("   spaced   ");

        Assert.Equal("spaced", message.Message);
    }

    [Fact]
    public void Command_WithArgument_SplitsModifierAndMessage()
    {
        var message = ChatMessage.FromMessage("/shout hello world");

        Assert.Equal("shout", message.Modifier);
        Assert.Equal("hello world", message.Message);
    }

    [Fact]
    public void Command_WithoutArgument_HasEmptyMessage()
    {
        var message = ChatMessage.FromMessage("/help");

        Assert.Equal("help", message.Modifier);
        Assert.Equal("", message.Message);
    }

    [Fact]
    public void Command_ModifierIsLowercased()
    {
        var message = ChatMessage.FromMessage("/HELP");

        Assert.Equal("help", message.Modifier);
    }

    [Theory]
    [InlineData("about")]
    [InlineData("help")]
    [InlineData("llm")]
    public void IsCommand_TrueForKnownCommands(string command)
    {
        var message = ChatMessage.FromMessage($"/{command}");

        Assert.True(message.IsCommand);
    }

    [Theory]
    [InlineData("shout")]
    [InlineData("whisper")]
    public void Emotes_AreNotCommands(string emote)
    {
        // emotes flow through as regular messages carrying a modifier, not commands
        var message = ChatMessage.FromMessage($"/{emote} hi");

        Assert.False(message.IsCommand);
        Assert.Equal(emote, message.Modifier);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("/")]
    public void IsEmpty_TrueForBlankOrBareSlash(string input)
    {
        var message = ChatMessage.FromMessage(input);

        Assert.True(message.IsEmpty);
    }

    [Fact]
    public void Equality_MatchesOnMessageAndModifier()
    {
        var a = ChatMessage.FromMessage("/shout hi");
        var b = ChatMessage.FromMessage("/shout hi");
        var c = ChatMessage.FromMessage("/whisper hi");

        Assert.True(a == b);
        Assert.True(a != c);
        Assert.Equal(a.GetHashCode(), b.GetHashCode());
    }
}
