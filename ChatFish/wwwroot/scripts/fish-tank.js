// Fish-tank interop helpers, invoked from Fish.razor / FishTank.razor via IJSRuntime.
// Loaded as a classic (non-module) script so these stay attached to `window`.

window.setElementPosition = (element, left, top) => {
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
};

window.getTankRect = () => {
  const element = document.getElementById("fishTank");
  if (!element) return null;

  return element.getBoundingClientRect();
};

window.getElementRect = (element) => {
  if (!element) return null;
  return element.getBoundingClientRect();
};

window.makeDraggable = (element, dotNetRef) => {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  element.onmousedown = function dragMouseDown(e) {
    dotNetRef.invokeMethodAsync("OnDraggingStart");
    e = e || window.event;
    e.preventDefault();

    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;

    // drag functions
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  };

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    // set the element's new position:
    element.style.top = element.offsetTop - pos2 + "px";
    element.style.left = element.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    // disable drag functions when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;

    // let the c# know the new position
    dotNetRef.invokeMethodAsync(
      "OnDraggingComplete",
      parseInt(element.style.left, 10),
      parseInt(element.style.top, 10)
    );
  }
};
