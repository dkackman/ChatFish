namespace ChatFish.Components;

public class FishAnimation()
{
    public Size Size { get; private set; } = new();
    public Point Position { get; private set; } = new();
    public Velocity Velocity { get; private set; } = new();
    public bool Enabled { get; set; } = true;

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

    // this is called on the animation loop
    public void IncrementPosition(ClientRect tank, ClientRect fish)
    {
        var nextVelocity = GetNextVelocity();
        var currentPosition = new Point(fish.Left, fish.Top);
        var nextPosition = currentPosition + Velocity;

        Size = new Size(fish.Height, fish.Width);
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
        // check the y bounds
        if (nextPosition.Top <= tankRect.Top)
        {
            currentVelocity = new Velocity(currentVelocity.Dx, Math.Abs(currentVelocity.Dy));
        }
        else if (nextPosition.Top + size.Height >= tankRect.Bottom)
        {
            currentVelocity = new Velocity(currentVelocity.Dx, -Math.Abs(currentVelocity.Dy));
        }

        // check the x bounds
        if (nextPosition.Left <= tankRect.Left)
        {
            currentVelocity = new Velocity(Math.Abs(currentVelocity.Dx), currentVelocity.Dy);
        }
        else if (nextPosition.Left + size.Width >= tankRect.Right)
        {
            currentVelocity = new Velocity(-Math.Abs(currentVelocity.Dx), currentVelocity.Dy);
        }

        return currentVelocity;
    }
}