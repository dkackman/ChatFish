export type FloatingPosition = "TopRight" | "TopLeft" | "BottomRight" | "BottomLeft";

export function positionClasses(position: FloatingPosition): string {
  const base = "position-fixed p-3";
  switch (position) {
    case "TopLeft":
      return `${base} top-0 start-0`;
    case "BottomRight":
      return `${base} bottom-0 end-0`;
    case "BottomLeft":
      return `${base} bottom-0 start-0`;
    default:
      return `${base} top-0 end-0`;
  }
}
