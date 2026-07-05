using ChatFish.Components;

namespace ChatFish.Tests;

public class FishColorTests
{
    [Theory]
    [InlineData(FishColor.Blue, "rgba(173, 216, 230, .65)")]
    [InlineData(FishColor.Green, "rgba(144, 238, 144, .65)")]
    [InlineData(FishColor.Orange, "rgba(255, 218, 185, .65)")]
    [InlineData(FishColor.Pink, "rgba(255, 182, 193, .65)")]
    [InlineData(FishColor.Yellow, "rgba(255, 255, 224, .65)")]
    [InlineData(FishColor.Red, "rgba(255, 160, 122, .65)")]
    public void GetColorRgba_MapsKnownColors(FishColor color, string expected) => Assert.Equal(expected, color.GetColorRgba());

    [Fact]
    public void GetColorRgba_UnknownColor_FallsBackToGray() => Assert.Equal("rgba(220, 220, 220, .65)", ((FishColor)999).GetColorRgba());
}
