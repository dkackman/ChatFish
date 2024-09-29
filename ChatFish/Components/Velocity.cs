namespace ChatFish.Components;

public readonly struct Velocity(double dx, double dy)
{
    public double Dx { get; } = dx;
    public double Dy { get; } = dy;
    public Direction Direction => Dx > 0 ? Direction.Right : Direction.Left;
    public Velocity OtherDirection() => new(-Dx, Dy);

    public override readonly string ToString() => $"[dx: {Dx}, dy: {Dy}]";
}