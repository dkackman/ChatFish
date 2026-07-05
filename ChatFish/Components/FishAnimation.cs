namespace ChatFish.Components;

public class FishAnimation()
{
    public Size Size { get; private set; } = new();
    public Point Position { get; private set; } = new();
    public Velocity Velocity { get; private set; } = new();
    public bool Enabled { get; set; } = true;

    // The fish size is measured from the DOM once (after its image has loaded) and
    // cached, so the animation loop no longer needs a per-tick interop round-trip.
    public bool HasSize { get; private set; }

    public void SetSize(Size size)
    {
        if (size.Width > 0 && size.Height > 0)
        {
            Size = size;
            HasSize = true;
        }
    }

    public void InitializePosition(ClientRect tankRect)
    {
        // the 50 is buffer to keep the fish from being placed too close to the edge
        var left = (tankRect.Width - 50.0) * Random.Shared.NextDouble();
        var top = (tankRect.Height - 50.0) * Random.Shared.NextDouble();

        Position = new Point(left, top);
        Velocity = GetRandomVelocity(Random.Shared.Next(0, 2) == 0 ? Direction.Left : Direction.Right);
    }

    // this is called when dragging the fish is complete
    public void MoveFish(Point newPosition)
    {
        Position = newPosition;
        Velocity = GetRandomVelocity(Velocity.OtherDirection().Direction);
    }

    // this is called on the animation loop; the whole simulation runs in C# using
    // the fish's cached size and its tank-relative Position (no per-tick interop).
    public void IncrementPosition(ClientRect tank)
    {
        var nextVelocity = GetNextVelocity();
        var nextPosition = Position + Velocity;

        Velocity = AdjustVelocityForBoundaries(nextVelocity, Size, nextPosition, tank);
        Position += Velocity;
    }

    private static Velocity GetRandomVelocity(Direction direction)
    {
        var directionModifier = direction == Direction.Right ? 1 : -1;
        return new((Random.Shared.NextDouble() * 3.0 + 0.5) * directionModifier, (Random.Shared.NextDouble() - 0.5) * 0.5);
    }

    private Velocity GetNextVelocity()
    {
        // randomly change direction and/or speed
        var changeDirection = Random.Shared.Next(0, 400) < 1;
        var changeSpeed = Random.Shared.Next(0, 300) < 1;
        var newDirectionVelocity = changeDirection ? Velocity.OtherDirection() : Velocity;

        // always change speed if direction changed
        return changeSpeed || changeDirection ? GetRandomVelocity(newDirectionVelocity.Direction) : newDirectionVelocity;
    }

    private static Velocity AdjustVelocityForBoundaries(Velocity currentVelocity, Size size, Point nextPosition, ClientRect tankRect)
    {
        // Position is tank-relative, so the tank spans (0, 0) to (Width, Height).
        // check the y bounds
        if (nextPosition.Top <= 0)
        {
            currentVelocity = new Velocity(currentVelocity.Dx, Math.Abs(currentVelocity.Dy));
        }
        else if (nextPosition.Top + size.Height >= tankRect.Height)
        {
            currentVelocity = new Velocity(currentVelocity.Dx, -Math.Abs(currentVelocity.Dy));
        }

        // check the x bounds
        if (nextPosition.Left <= 0)
        {
            currentVelocity = new Velocity(Math.Abs(currentVelocity.Dx), currentVelocity.Dy);
        }
        else if (nextPosition.Left + size.Width >= tankRect.Width)
        {
            currentVelocity = new Velocity(-Math.Abs(currentVelocity.Dx), currentVelocity.Dy);
        }

        return currentVelocity;
    }
}