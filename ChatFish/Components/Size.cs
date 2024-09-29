namespace ChatFish.Components;

public readonly struct Size(double height, double width)
{
    public double Height { get; } = height;
    public double Width { get; } = width;

    public override readonly string ToString() => $"[Height: {Height}, Width: {Width}]";
}