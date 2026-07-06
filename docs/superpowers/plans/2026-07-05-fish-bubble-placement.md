# Fish + Bubble On-Screen Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the fish and its speech bubble fully on screen for long messages, with the bubble placed ahead of the fish and flipping above/below to avoid clipping.

**Architecture:** The speech bubble is decoupled from layout (made `position: absolute`) so a tall bubble no longer shoves the fish down and the fish's cached size measures the fish alone. Placement math lives in `FishAnimation` (C#, unit-tested): it picks the bubble's vertical side (above if there's room, else below), keeps it horizontally ahead of the fish's facing direction, and — while a message is showing — reflects the fish's horizontal velocity against the fish+bubble extent so the fish turns before the bubble reaches a side wall. A single JS measurement per message feeds the bubble's real size into the simulation.

**Tech Stack:** Blazor WebAssembly (.NET), C#, JS interop, component-scoped CSS, xUnit.

## Global Constraints

- Format doubles for CSS with `CultureInfo.InvariantCulture` (existing `Css()` helper in `Fish.razor`) so a decimal comma never produces invalid CSS.
- Physics `Position` is **tank-relative**: the tank spans `(0, 0)` to `(Width, Height)`.
- The animation loop must stay interop-free per tick; the only added interop is one bubble measurement when the message text changes.
- Follow existing patterns: readonly structs for geometry (`Point`, `Size`, `Velocity`, `ClientRect`), `Direction` enum, private-setter public properties on `FishAnimation`.

---

### Task 1: Bubble placement math in `FishAnimation` (C#, TDD)

**Files:**

- Create: `ChatFish/Components/BubbleVerticalSide.cs`
- Modify: `ChatFish/Components/FishAnimation.cs`
- Test: `ChatFish.Tests/FishAnimationTests.cs`

**Interfaces:**

- Consumes: `Point`, `Size`, `Velocity`, `Direction`, `ClientRect` (existing structs/enums).
- Produces (used by Task 2):
  - `enum BubbleVerticalSide { Above, Below }`
  - `void FishAnimation.SetBubble(Size size)` — records the measured bubble size and marks the fish as talking (ignores non-positive sizes, like `SetSize`).
  - `void FishAnimation.ClearBubble()` — marks the fish as not talking and clears bubble geometry.
  - `bool FishAnimation.HasMessage { get; }`
  - `Size FishAnimation.BubbleSize { get; }`
  - `BubbleVerticalSide FishAnimation.BubbleSide { get; }` — updated each tick while talking.
  - `ClientRect FishAnimation.BubbleBounds { get; }` — the bubble's tank-relative box (clamped into the tank), updated each tick while talking; `default` when not talking.

- [ ] **Step 1: Create the `BubbleVerticalSide` enum**

Create `ChatFish/Components/BubbleVerticalSide.cs`:

```csharp
namespace ChatFish.Components;

public enum BubbleVerticalSide
{
    Above,
    Below
}
```

- [ ] **Step 2: Write the failing tests**

Add these tests to `ChatFish.Tests/FishAnimationTests.cs` (inside the existing `FishAnimationTests` class, keeping the existing `Tank` helper and existing tests):

```csharp
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `dotnet test ChatFish.Tests/ChatFish.Tests.csproj`
Expected: FAIL — compile errors (`SetBubble`, `HasMessage`, `BubbleSize`, `BubbleSide`, `BubbleBounds`, `ClearBubble` do not exist yet).

- [ ] **Step 4: Implement the placement math**

Replace the entire contents of `ChatFish/Components/FishAnimation.cs` with:

```csharp
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dotnet test ChatFish.Tests/ChatFish.Tests.csproj`
Expected: PASS — all existing tests plus the five new ones. In particular `IncrementPosition_KeepsFishWithinTank` (existing, no message) still passes because `HorizontalExtent` returns the plain fish box when `HasMessage` is false.

- [ ] **Step 6: Commit**

```bash
git add ChatFish/Components/BubbleVerticalSide.cs ChatFish/Components/FishAnimation.cs ChatFish.Tests/FishAnimationTests.cs
git commit -m "Add bubble placement + on-screen physics to FishAnimation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Decouple the bubble in the view (Razor, CSS, JS)

**Files:**

- Modify: `ChatFish/wwwroot/scripts/fish-tank.js`
- Modify: `ChatFish/Components/MessageBubble.razor`
- Modify: `ChatFish/Components/MessageBubble.razor.css`
- Modify: `ChatFish/Components/Fish.razor`

**Interfaces:**

- Consumes (from Task 1): `FishAnimation.SetBubble(Size)`, `ClearBubble()`, `BubbleSide`, `HasMessage`; `BubbleVerticalSide`.
- Produces: `window.getBubbleRect(fishElement)` → the bubble's `getBoundingClientRect()`; `MessageBubble` renders an `above`/`below` class from a `VerticalSide` parameter.

This task has no unit test (Blazor UI + CSS); it is verified by build + running the app.

- [ ] **Step 1: Add the `getBubbleRect` interop helper**

In `ChatFish/wwwroot/scripts/fish-tank.js`, add after the `getElementRect` function (around line 19):

```javascript
window.getBubbleRect = (fishElement) => {
  if (!fishElement) return null;
  const bubble = fishElement.querySelector(".message-bubble");
  if (!bubble) return null;
  return bubble.getBoundingClientRect();
};
```

- [ ] **Step 2: Add the vertical-side parameter to `MessageBubble`**

In `ChatFish/Components/MessageBubble.razor`, add `@VerticalSide.ToString().ToLower()` to the class list and a `VerticalSide` parameter. Replace the file contents with:

```razor
@using Ganss.Xss
@using ChatFish.Components
@using ChatFish.State
@inject HtmlSanitizer Sanitizer

<div class="message-bubble @(IsVisible ? "visible" : "hidden") @Sanitizer.Sanitize(Message.Modifier) @FishDirection.ToString().ToLower() @VerticalSide.ToString().ToLower()"
    role="status" aria-live="polite">
    @(Sanitizer.Sanitize(Message.Message))
</div>

@code {
    [Parameter] public ChatMessage Message { get; set; } = new();
    [Parameter] public bool IsVisible { get; set; }
    [Parameter] public Direction FishDirection { get; set; }
    [Parameter] public BubbleVerticalSide VerticalSide { get; set; } = BubbleVerticalSide.Above;
}
```

- [ ] **Step 3: Make the bubble absolutely positioned with above/below anchoring**

In `ChatFish/Components/MessageBubble.razor.css`:

Add `position: absolute;` and `left: 50%;` to the base `.message-bubble` rule (insert after the `text-align: center;` line, before the closing brace at line 17):

```css
text-align: center;
position: absolute;
left: 50%;
```

Replace the two facing-direction rules (lines 31-42) — which currently read `translateX(-43%)` / `translateX(43%)` — with values that also re-centre the now-absolute bubble (`-50%`) and add the vertical-anchor rules:

```css
/* Adjust the bubble position based on the fish direction.
   The bubble is absolutely positioned at the fish centre (left: 50%); the
   -50% re-centres it and the +/-43% pushes it ahead of the fish. */
.message-bubble.left {
  transform: translateX(-93%);

  /* Move bubble ahead of left-facing fish */
}

.message-bubble.right {
  transform: translateX(-7%);

  /* Move bubble ahead of right-facing fish */
}

/* Vertical anchoring: above the fish when there is room, below otherwise.
   The vertical side is chosen in FishAnimation.ComputeBubbleRect. */
.message-bubble.above {
  bottom: 100%;
}

.message-bubble.below {
  top: 100%;
}
```

Leave the rest of the file (the `::before`/`::after` trailing-bubble and gloss rules, modifiers, visibility) unchanged.

- [ ] **Step 4: Wire measurement and side into `Fish.razor`**

In `ChatFish/Components/Fish.razor`:

(a) Pass the computed side to the bubble — replace the `<MessageBubble ... />` element (lines 13-14) with:

```razor
    <MessageBubble Message="@State.CurrentMessage" IsVisible="@State.IsMessageVisible"
        FishDirection="@_fishAnimation.Velocity.Direction" VerticalSide="@_fishAnimation.BubbleSide" />
```

(b) Add a pending-measure flag — add this field next to the other private fields (after line 34, `private bool _disposed;`):

```csharp
    private bool _pendingBubbleMeasure;
```

(c) Measure the bubble after the message renders — add this block to `OnAfterRenderAsync`, after the closing brace of the existing `if (firstRender) { ... }` block (after line 70), still inside the method:

```csharp
        if (!firstRender && _pendingBubbleMeasure && !_disposed)
        {
            _pendingBubbleMeasure = false;
            var bubbleRect = await JSRuntime.InvokeAsync<ClientRect>("getBubbleRect", fishElement);
            _fishAnimation.SetBubble(new Size(bubbleRect.Height, bubbleRect.Width));
        }
```

Note: `OnAfterRenderAsync` is already `async Task` and already wraps interop; the enclosing component tear-down is handled by the `_disposed` guard.

(d) Trigger a measure (or clear) when the message changes — replace the `MessageChanged` method (lines 73-76):

```csharp
    private void MessageChanged()
    {
        if (State is { IsMessageVisible: true })
        {
            _pendingBubbleMeasure = true;
        }
        else
        {
            _fishAnimation.ClearBubble();
        }

        StateHasChanged();
    }
```

- [ ] **Step 5: Build**

Run: `dotnet build ChatFish/ChatFish.csproj`
Expected: Build succeeded, 0 errors.

- [ ] **Step 6: Verify in the app**

Run the app (`dotnet run --project ChatFish/ChatFish.csproj`) and, using the `/run` skill or the browser:

- Send a **long** message to a fish near the **top** edge → the bubble renders **below** the fish and the fish stays fully visible (previously it was pushed off the bottom).
- Send a message to a fish near the **middle** → the bubble renders **above** the fish, ahead of its swimming direction.
- Watch a talking fish approach a **side** wall → it turns around before the bubble clips the edge.
- Confirm an idle (silent) fish swims exactly as before, edge to edge.

- [ ] **Step 7: Commit**

```bash
git add ChatFish/wwwroot/scripts/fish-tank.js ChatFish/Components/MessageBubble.razor ChatFish/Components/MessageBubble.razor.css ChatFish/Components/Fish.razor
git commit -m "Decouple speech bubble from fish layout and place it on screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes on design decisions

- **Vertical by flip, horizontal by reflect.** The spec calls for reflecting against the fish+bubble union. In practice vertical clipping is best solved by flipping the bubble above/below (no need to disturb the fish's vertical bounce), while the horizontal "ahead" offset is what needs the fish to steer away from side walls. Splitting the two keeps the fish's familiar vertical motion intact while still guaranteeing the whole ensemble stays on screen.
- **`ClientRect` reused for `BubbleBounds`** rather than introducing a new rect type — it already carries `Left/Top/Width/Height/Right/Bottom` and is the type interop already returns.
- **Measurement cadence:** the bubble is measured once when the message text changes (via `_pendingBubbleMeasure` + `OnAfterRenderAsync`), never per tick, honoring the interop-free-loop constraint.
