namespace ChatFish.Components;

public readonly struct Point(double left, double top)
{
    public double Left { get; } = left;
    public double Top { get; } = top;

    public override readonly string ToString() => $"[Left: {Left}, Top: {Top}]";

    // Operator overload to add Velocity to a Point - meaning moving the point by the velocity vector
    public static Point operator +(Point point, Velocity velocity) => new(point.Left + velocity.Dx, point.Top + velocity.Dy);
}