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
                _logger.LogDebug("Unknown command: {commandName}", command);
                break;
        }
    }
}