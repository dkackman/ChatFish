using ChatFish.Components;

namespace ChatFish.Tests;

public class FishAnimationTests
{
    private static ClientRect Tank(double width, double height) => new()
    {
        X = 0,
        Y = 0,
        Left = 0,
        Top = 0,
        Right = width,
        Bottom = height,
        Width = width,
        Height = height,
    };

    private static ClientRect FishAt(Point position, double size) => new()
    {
        Left = position.Left,
        Top = position.Top,
        Right = position.Left + size,
        Bottom = position.Top + size,
        Width = size,
        Height = size,
    };

    [Fact]
    public void InitializePosition_PlacesFishInsideTank()
    {
        var tank = Tank(800, 600);

        // random placement: verify it holds across many draws
        for (var i = 0; i < 500; i++)
        {
            var animation = new FishAnimation();
            animation.InitializePosition(tank);

            Assert.InRange(animation.Position.Left, 0, tank.Width);
            Assert.InRange(animation.Position.Top, 0, tank.Height);
        }
    }

    [Fact]
    public void IncrementPosition_KeepsFishWithinTank()
    {
        const double size = 50;
        var tank = Tank(800, 600);
        var animation = new FishAnimation();
        animation.InitializePosition(tank);

        // Simulate the animation loop, feeding the fish's own position back in as its
        // DOM rect. The boundary logic should keep it from escaping the tank; a small
        // tolerance covers the single step it may take before a bounce reverses it.
        const double tolerance = 10; // > max per-step speed (~3.5)
        for (var tick = 0; tick < 5000; tick++)
        {
            animation.IncrementPosition(tank, FishAt(animation.Position, size));

            Assert.InRange(animation.Position.Left, -tolerance, tank.Right + tolerance);
            Assert.InRange(animation.Position.Top, -tolerance, tank.Bottom - size + tolerance);
        }
    }

    [Fact]
    public void MoveFish_UpdatesPositionAndReversesDirection()
    {
        var tank = Tank(800, 600);
        var animation = new FishAnimation();
        animation.InitializePosition(tank);
        var originalDirection = animation.Velocity.Direction;

        animation.MoveFish(new Point(123, 456));

        Assert.Equal(123, animation.Position.Left);
        Assert.Equal(456, animation.Position.Top);
        Assert.NotEqual(originalDirection, animation.Velocity.Direction);
    }
}
