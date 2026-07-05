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

    // Bubble state. The bubble is measured once per message (its size changes with the
    // text) and fed in via SetBubble; the simulation then keeps the whole talking
    // ensemble on screen and reports where the bubble should be drawn.
    public bool HasMessage { get; private set; }
    public Size BubbleSize { get; private set; }
    public BubbleVerticalSide BubbleSide { get; private set; } = BubbleVerticalSide.Above;
    public ClientRect BubbleBounds { get; private set; }

    public void SetSize(Size size)
    {
        if (size.Width > 0 && size.Height > 0)
        {
            Size = size;
            HasSize = true;
        }
    }

    // Called when a message becomes visible; size is measured from the rendered bubble.
    public void SetBubble(Size size)
    {
        if (size.Width > 0 && size.Height > 0)
        {
            BubbleSize = size;
            HasMessage = true;
        }
    }

    // Called when the message is hidden; the fish goes back to plain fish-box physics.
    public void ClearBubble()
    {
        HasMessage = false;
        BubbleSize = default;
        BubbleBounds = default;
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

        BubbleBounds = HasMessage ? ComputeBubbleRect(Position, tank) : default;
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

    private Velocity AdjustVelocityForBoundaries(Velocity currentVelocity, Size size, Point nextPosition, ClientRect tankRect)
    {
        // Position is tank-relative, so the tank spans (0, 0) to (Width, Height).
        // Vertical bounds use the fish box only; the bubble avoids vertical clipping
        // by flipping above/below (see ComputeBubbleRect).
        if (nextPosition.Top <= 0)
        {
            currentVelocity = new Velocity(currentVelocity.Dx, Math.Abs(currentVelocity.Dy));
        }
        else if (nextPosition.Top + size.Height >= tankRect.Height)
        {
            currentVelocity = new Velocity(currentVelocity.Dx, -Math.Abs(currentVelocity.Dy));
        }

        // Horizontal bounds: while talking, include the bubble that sits ahead of the
        // fish so the fish turns around before the bubble reaches a side wall.
        var (leftExtent, rightExtent) = HorizontalExtent(nextPosition, size, currentVelocity.Direction);
        if (leftExtent <= 0)
        {
            currentVelocity = new Velocity(Math.Abs(currentVelocity.Dx), currentVelocity.Dy);
        }
        else if (rightExtent >= tankRect.Width)
        {
            currentVelocity = new Velocity(-Math.Abs(currentVelocity.Dx), currentVelocity.Dy);
        }

        return currentVelocity;
    }

    // The horizontal span the fish occupies. While talking this includes the bubble,
    // which extends from the fish centre outward in the facing direction.
    private (double Left, double Right) HorizontalExtent(Point position, Size size, Direction direction)
    {
        var fishLeft = position.Left;
        var fishRight = position.Left + size.Width;
        if (!HasMessage)
        {
            return (fishLeft, fishRight);
        }

        var centerX = position.Left + size.Width / 2.0;
        return direction == Direction.Right
            ? (fishLeft, centerX + BubbleSize.Width)
            : (centerX - BubbleSize.Width, fishRight);
    }

    // Where to draw the bubble: ahead of the fish's facing direction, above the fish if
    // there is room and below otherwise, clamped so it stays inside the tank.
    private ClientRect ComputeBubbleRect(Point position, ClientRect tank)
    {
        var top = position.Top - BubbleSize.Height;
        if (top < 0)
        {
            BubbleSide = BubbleVerticalSide.Below;
            top = position.Top + Size.Height;
        }
        else
        {
            BubbleSide = BubbleVerticalSide.Above;
        }

        var centerX = position.Left + Size.Width / 2.0;
        var left = Velocity.Direction == Direction.Right ? centerX : centerX - BubbleSize.Width;
        left = Math.Clamp(left, 0, Math.Max(0, tank.Width - BubbleSize.Width));

        return new ClientRect
        {
            X = left,
            Y = top,
            Left = left,
            Top = top,
            Width = BubbleSize.Width,
            Height = BubbleSize.Height,
            Right = left + BubbleSize.Width,
            Bottom = top + BubbleSize.Height,
        };
    }
}
