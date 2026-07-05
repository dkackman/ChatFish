using ChatFish;
using ChatFish.Components;
using ChatFish.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.JSInterop;

namespace ChatFish.Tests;

public class MessageDispatcherTests
{
    // Records every JS call so we can tell whether a message was routed to the LLM
    // (which ultimately calls "sendLLMMessage") versus handled as a command.
    private sealed class RecordingJSRuntime : IJSRuntime
    {
        public List<string> Invocations { get; } = [];

        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
        {
            Invocations.Add(identifier);
            return new ValueTask<TValue>(default(TValue)!);
        }

        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args)
        {
            Invocations.Add(identifier);
            return new ValueTask<TValue>(default(TValue)!);
        }
    }

    private static (MessageDispatcher dispatcher, RecordingJSRuntime js) CreateDispatcher()
    {
        var js = new RecordingJSRuntime();
        var llm = new LLMService(js, NullLogger<LLMService>.Instance);
        var client = new FishTankClient(llm, NullLogger<FishTankClient>.Instance);
        client.Initialize();
        var dispatcher = new MessageDispatcher(client, NullLogger<MessageDispatcher>.Instance);
        return (dispatcher, js);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("/")]
    public async Task EmptyMessage_IsIgnored(string input)
    {
        var (dispatcher, js) = CreateDispatcher();
        var toasts = 0;
        dispatcher.OnToastRequested += _ => toasts++;
        dispatcher.OnCommand += _ => toasts++;

        await dispatcher.DispatchMessageAsync(input);

        Assert.Empty(js.Invocations);
        Assert.Equal(0, toasts);
    }

    [Fact]
    public async Task HelpCommand_RaisesToastListingCommandsAndEmotes()
    {
        var (dispatcher, _) = CreateDispatcher();
        Toast? captured = null;
        dispatcher.OnToastRequested += t => captured = t;

        await dispatcher.DispatchMessageAsync("/help");

        Assert.NotNull(captured);
        Assert.Equal("Help", captured!.Title);
        Assert.Contains(captured.Messages, m => m.StartsWith("/help"));
        Assert.Contains(captured.Messages, m => m.StartsWith("/about"));
        Assert.Contains(captured.Messages, m => m.StartsWith("/shout")); // emote listed too
    }

    [Fact]
    public async Task AboutCommand_RequestsGithubUrl()
    {
        var (dispatcher, _) = CreateDispatcher();
        string? url = null;
        dispatcher.OnOpenUrlRequested += u => url = u;

        await dispatcher.DispatchMessageAsync("/about");

        Assert.Equal("https://github.com/dkackman/ChatFish", url);
    }

    [Fact]
    public async Task KnownCommandWithoutBuiltinHandler_IsDelegatedToSubscribers()
    {
        var (dispatcher, _) = CreateDispatcher();
        string? delegated = null;
        dispatcher.OnCommand += c => delegated = c;

        // "/llm" is a known command but handled by a subscriber, not the switch
        await dispatcher.DispatchMessageAsync("/llm");

        Assert.Equal("llm", delegated);
    }

    [Fact]
    public async Task PlainMessage_IsSentToTheLlm()
    {
        var (dispatcher, js) = CreateDispatcher();
        var commandEvents = 0;
        dispatcher.OnToastRequested += _ => commandEvents++;
        dispatcher.OnCommand += _ => commandEvents++;

        await dispatcher.DispatchMessageAsync("hello fish");

        Assert.Contains("sendLLMMessage", js.Invocations);
        Assert.Equal(0, commandEvents);
    }

    [Fact]
    public async Task Emote_IsSentToTheLlmNotTreatedAsCommand()
    {
        var (dispatcher, js) = CreateDispatcher();
        var commandEvents = 0;
        dispatcher.OnCommand += _ => commandEvents++;

        await dispatcher.DispatchMessageAsync("/shout hello");

        Assert.Contains("sendLLMMessage", js.Invocations);
        Assert.Equal(0, commandEvents);
    }
}
