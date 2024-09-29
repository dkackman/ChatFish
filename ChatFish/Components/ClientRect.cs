namespace ChatFish.Components;

public readonly struct ClientRect
{
    public double X { get; init; }
    public double Y { get; init; }
    public double Width { get; init; }
    public double Height { get; init; }
    public double Top { get; init; }
    public double Right { get; init; }
    public double Bottom { get; init; }
    public double Left { get; init; }

    public override readonly string ToString() => $"[X: {X}, Top: {Y} Width: {Width}, Height: {Height}]";
}