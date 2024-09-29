namespace ChatFish.Components;

public class Toast
{
    public string Title { get; init; } = "";
    public string Caption { get; init; } = "";
    public IEnumerable<string> Messages { get; init; } = [];
}