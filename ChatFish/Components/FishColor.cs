namespace ChatFish.Components;

public enum FishColor
{
    Blue,
    Green,
    Orange,
    Pink,
    Yellow,
    Red
}

public static class FishColorExtensions
{
    public static string GetColorRgba(this FishColor color)
    {
        var (r, g, b) = color switch
        {
            FishColor.Blue => (173, 216, 230), // Light Blue
            FishColor.Green => (144, 238, 144), // Light Green
            FishColor.Orange => (255, 218, 185), // Peach
            FishColor.Pink => (255, 182, 193), // Light Pink
            FishColor.Yellow => (255, 255, 224), // Light Yellow
            FishColor.Red => (255, 160, 122), // Light Salmon
            _ => (220, 220, 220), // Light Gray
        };
        return $"rgba({r}, {g}, {b}, .65)"; // 0.7 opacity for slight transparency
    }
}