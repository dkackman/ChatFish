using ChatFish.Components;

namespace ChatFish.Tests;

public class VelocityTests
{
    [Fact]
    public void PositiveDx_FacesRight()
    {
        Assert.Equal(Direction.Right, new Velocity(1.5, 0).Direction);
    }

    [Fact]
    public void NegativeDx_FacesLeft()
    {
        Assert.Equal(Direction.Left, new Velocity(-1.5, 0).Direction);
    }

    [Fact]
    public void OtherDirection_FlipsHorizontalKeepsVertical()
    {
        var flipped = new Velocity(2.0, 0.3).OtherDirection();

        Assert.Equal(-2.0, flipped.Dx);
        Assert.Equal(0.3, flipped.Dy);
    }

    [Fact]
    public void PointPlusVelocity_TranslatesByVector()
    {
        var moved = new Point(10, 20) + new Velocity(3, -4);

        Assert.Equal(13, moved.Left);
        Assert.Equal(16, moved.Top);
    }
}
