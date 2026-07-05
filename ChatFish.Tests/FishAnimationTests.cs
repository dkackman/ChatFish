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
        animation.SetSize(new Size(size, size)); // measured once from the DOM in the real app

        // Run the (tank-relative) simulation many ticks. The boundary logic should keep
        // the fish inside the tank; a small tolerance covers the single step it may take
        // before a bounce reverses it.
        const double tolerance = 10; // > max per-step speed (~3.5)
        for (var tick = 0; tick < 5000; tick++)
        {
            animation.IncrementPosition(tank);

            Assert.InRange(animation.Position.Left, -tolerance, tank.Width - size + tolerance);
            Assert.InRange(animation.Position.Top, -tolerance, tank.Height - size + tolerance);
        }
    }

    [Fact]
    public void SetSize_IgnoresZeroSizedMeasurements()
    {
        var animation = new FishAnimation();

        animation.SetSize(new Size(0, 0)); // image not loaded yet
        Assert.False(animation.HasSize);

        animation.SetSize(new Size(48, 64)); // real measurement
        Assert.True(animation.HasSize);
        Assert.Equal(48, animation.Size.Height);
        Assert.Equal(64, animation.Size.Width);
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

    [Fact]
    public void SetBubble_IgnoresZeroSizedMeasurements()
    {
        var animation = new FishAnimation();

        animation.SetBubble(new Size(0, 0));
        Assert.False(animation.HasMessage);

        animation.SetBubble(new Size(120, 200));
        Assert.True(animation.HasMessage);
        Assert.Equal(120, animation.BubbleSize.Height);
        Assert.Equal(200, animation.BubbleSize.Width);

        animation.ClearBubble();
        Assert.False(animation.HasMessage);
    }

    [Fact]
    public void IncrementPosition_PlacesBubbleBelow_WhenNoRoomAbove()
    {
        var tank = Tank(800, 600);
        var animation = new FishAnimation();
        animation.InitializePosition(tank);
        animation.SetSize(new Size(50, 50));
        animation.SetBubble(new Size(150, 200)); // bubble is 150 tall

        // Park the fish hard against the top edge: no room for a 150px bubble above it.
        animation.MoveFish(new Point(400, 0));
        animation.IncrementPosition(tank);

        Assert.Equal(BubbleVerticalSide.Below, animation.BubbleSide);
    }

    [Fact]
    public void IncrementPosition_PlacesBubbleAbove_WhenRoomExists()
    {
        var tank = Tank(800, 600);
        var animation = new FishAnimation();
        animation.InitializePosition(tank);
        animation.SetSize(new Size(50, 50));
        animation.SetBubble(new Size(150, 200));

        // Plenty of room above the fish.
        animation.MoveFish(new Point(400, 400));
        animation.IncrementPosition(tank);

        Assert.Equal(BubbleVerticalSide.Above, animation.BubbleSide);
    }

    [Fact]
    public void IncrementPosition_KeepsTalkingFishAndBubbleWithinTank()
    {
        const double fish = 50;
        const double bubbleWidth = 200;
        var tank = Tank(800, 600);
        var animation = new FishAnimation();
        animation.InitializePosition(tank);
        animation.SetSize(new Size(fish, fish));
        animation.SetBubble(new Size(120, bubbleWidth));

        const double tolerance = 10; // > max per-step speed (~3.5)
        for (var tick = 0; tick < 5000; tick++)
        {
            animation.IncrementPosition(tank);

            // The bubble sits ahead of the fish's facing direction, from the fish
            // centre outward. Verify that whole talking ensemble stays on screen.
            var centerX = animation.Position.Left + fish / 2;
            double leftExtent, rightExtent;
            if (animation.Velocity.Direction == Direction.Right)
            {
                leftExtent = animation.Position.Left;
                rightExtent = centerX + bubbleWidth;
            }
            else
            {
                leftExtent = centerX - bubbleWidth;
                rightExtent = animation.Position.Left + fish;
            }

            Assert.InRange(leftExtent, -tolerance, tank.Width);
            Assert.InRange(rightExtent, 0, tank.Width + tolerance);
        }
    }

    [Fact]
    public void IncrementPosition_LeavesBubbleBoundsEmpty_WhenNotTalking()
    {
        var tank = Tank(800, 600);
        var animation = new FishAnimation();
        animation.InitializePosition(tank);
        animation.SetSize(new Size(50, 50));

        animation.IncrementPosition(tank);

        Assert.False(animation.HasMessage);
        Assert.Equal(0, animation.BubbleBounds.Width);
        Assert.Equal(0, animation.BubbleBounds.Height);
    }
}
