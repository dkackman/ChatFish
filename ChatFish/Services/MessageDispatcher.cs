using ChatFish.Components;
using ChatFish.State;

namespace ChatFish.Services;

public class MessageDispatcher(FishTankClient fishTankClient, ILogger<MessageDispatcher> logger)
{
    private readonly FishTankClient _fishTankClient = fishTankClient;
    private readonly ILogger<MessageDispatcher> _logger = logger;

    public async Task DispatchMessageAsync(string message)
    {
        var chatMessage = ChatMessage.FromMessage(message);

        if (!chatMessage.IsEmpty)
        {
            if (chatMessage.IsCommand)
            {
                ProcessCommand(chatMessage.Modifier);
            }
            else
            {
                await _fishTankClient.SendMessageAsync(chatMessage);
            }
        }
    }

    public event Action<Toast>? OnToastRequested;
    public event Action<string>? OnOpenUrlRequested;
    public event Action<string>? OnCommand;

    private void ProcessCommand(string command)
    {
        _logger.LogDebug("Processing command: {commandName}", command);
        switch (command)
        {
            case "help":
                OnToastRequested?.Invoke(new Toast
                {
                    Title = "Help",
                    Caption = "Available commands",
                    Messages = [
                        ..ChatMessage.Commands.Select(x => $"/{x.Key} - {x.Value}"),
                        ..ChatMessage.Emotes.Select(x => $"/{x.Key} - {x.Value}"),
                    ],
                });
                break;

            case "about":
                OnOpenUrlRequested?.Invoke("https://github.com/dkackman/ChatFish");
                break;

            // Add more commands here as needed
            default:
                // ProcessCommand only runs for commands validated by ChatMessage.IsCommand,
                // so a command reaching here is known but handled by a subscriber (e.g. the
                // LLM settings dialog handles "/llm"), not unknown.
                _logger.LogDebug("Delegating command: {commandName}", command);
                OnCommand?.Invoke(command);
                break;
        }
    }
}