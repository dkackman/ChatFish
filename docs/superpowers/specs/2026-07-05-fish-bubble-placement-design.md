# Fish + Bubble Placement Design

**Date:** 2026-07-05
**Status:** Approved (design), pending implementation plan

## Problem

For long messages the fish gets pushed down and can move off screen.

**Root cause.** In [Fish.razor](../../../ChatFish/Components/Fish.razor), the fish container is
absolutely positioned at the simulated `Position` and lays its children out as a
`flex-direction: column` (see [Fish.razor.css](../../../ChatFish/Components/Fish.razor.css)). The
`MessageBubble` is the **first** child and the fish image sits **below** it, so the fish renders at
`Position.Top + bubbleHeight`. A long message grows a tall bubble that physically shoves the fish
downward.

The physics in [FishAnimation.cs](../../../ChatFish/Components/FishAnimation.cs) is unaware of this:

- It measures the container size **once** (`HasSize`, lines ~99-102) when the bubble is empty, and
  caches it — so the box it reasons about is stale.
- Its boundary check keeps `Position` (the container top-left, i.e. the bubble's top) inside the
  tank, not the fish. The fish itself can end up well below the bottom edge.

## Goals

- The fish and its bubble both stay fully on screen while a message is showing.
- Bubble placement is "smart and natural": it stays **ahead** of the fish's facing direction and
  flips **above/below** to avoid vertical clipping.
- The fish gently avoids edges while talking so there is always room for the bubble.

Chosen behavior: **both** — the bubble adapts to available space **and** the fish biases away from
edges while a message is visible.

Chosen placement set: **ahead-of-fish, above/below fallback** — keep the current "ahead of the
fish's facing direction" horizontal offset, flip above/below to avoid vertical clipping.

## Non-goals

- Fish-to-fish or bubble-to-bubble overlap avoidance between different fish (this was the heavier
  JS-driven "Approach C").
- Any change to message content, timing, or the chat pipeline.

## Approach (B — C# placement model)

Placement math lives in `FishAnimation` (C#), where the rest of the simulation already lives and is
unit-tested. Only a single JS measurement round-trip is added per message; CSS and the view are thin
glue.

### 1. Decouple the bubble from layout (CSS)

- Make `.message-bubble` `position: absolute`, anchored to the fish container, instead of an in-flow
  child of the flex column.
- The fish image becomes the only in-flow child, so:
  - The simulated `Position` is genuinely the fish's top-left (no downward shove from a tall bubble).
  - The once-cached `Size` measures the fish, not fish+bubble — the stale-measurement bug is
    resolved.
- The bubble carries a **vertical** class (`above` / `below`) in addition to the existing **facing**
  class (`left` / `right`) that offsets it ahead of the fish.

### 2. Measure the bubble

- Add a JS helper `getBubbleRect(fishElement)` (in
  [fish-tank.js](../../../ChatFish/wwwroot/scripts/fish-tank.js)) that finds the `.message-bubble`
  descendant of a fish element and returns its `ClientRect`.
- In [Fish.razor](../../../ChatFish/Components/Fish.razor), the component already subscribes to
  `State.MessageChanged`. When the message text changes, measure the bubble once after render and
  hand its `Size` to `FishAnimation`.
- An empty/hidden message means no bubble box (bubble contributes nothing to the physics).

### 3. Placement + physics in `FishAnimation`

New state:

- `Size BubbleSize` — the measured bubble size; empty when no message is visible.
- Message-visible flag (passed in or tracked) so the physics knows whether to include the bubble
  box.

New/changed methods:

- `ComputeBubbleRect(position, fishSize, bubbleSize, direction, tank)` → the bubble's box:
  - **Horizontal:** ahead of the facing direction (as today, the `left`/`right` offset), clamped so
    the box stays inside the tank horizontally.
  - **Vertical:** **above** the fish when there is room; otherwise **below**.
  - Returns the chosen vertical side (`Above` / `Below`) so the view can set the class.
- `AdjustVelocityForBoundaries` gains a message-aware path: when a message is visible, it reflects
  velocity against the **union of the fish box and the bubble box** at the next position, instead of
  the fish box alone.
  - This single change delivers both requested behaviors: the fish reflects/steers away from an edge
    early enough that the ahead-bubble always has room, and the bubble flips above/below on its own
    as its box approaches an edge.
  - When no message is visible, behavior is identical to today (fish box only).

### Data flow per tick

Unchanged animation loop → `IncrementPosition` now considers the bubble box when talking → the view
reads `Position` (fish placement) and the placement class (bubble side) and renders. The bubble is
measured only when the message text changes, not per tick.

## Testing

Mirrors the existing [FishAnimationTests.cs](../../../ChatFish.Tests/FishAnimationTests.cs):

- Bubble flips **below** when the fish is near the top edge with no room above.
- Fish **reflects early** (velocity component flips) when talking near an edge, so the bubble box
  stays inside the tank.
- Placement **clamps horizontally** near a side wall so the ahead-bubble does not cross the edge.
- **No behavior change** when no message is showing (physics matches current fish-box-only logic).

## Affected files

- [Fish.razor](../../../ChatFish/Components/Fish.razor) — measure bubble on message change, pass side
  class to view.
- [Fish.razor.css](../../../ChatFish/Components/Fish.razor.css) /
  [MessageBubble.razor.css](../../../ChatFish/Components/MessageBubble.razor.css) — absolute bubble,
  above/below classes.
- [MessageBubble.razor](../../../ChatFish/Components/MessageBubble.razor) — accept the vertical side.
- [FishAnimation.cs](../../../ChatFish/Components/FishAnimation.cs) — bubble size/state,
  `ComputeBubbleRect`, message-aware boundary reflection.
- [fish-tank.js](../../../ChatFish/wwwroot/scripts/fish-tank.js) — `getBubbleRect` helper.
- [FishAnimationTests.cs](../../../ChatFish.Tests/FishAnimationTests.cs) — new cases above.
