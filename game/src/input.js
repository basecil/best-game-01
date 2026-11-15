// TIDEGLASS — mouse and keyboard, read every frame. Clicks, drags and key
// presses queue up and are taken once per frame, so a slow frame never drops
// one and a held key never repeats. Positions come back in field coordinates
// (the renderer's toField maps the window onto the 1280x720 playfield).

const DRAG_MIN = 8;

export function createInput(canvas, toField) {
  const clicks = [];
  const drags = [];
  const keys = [];
  let hover = null;
  let downAt = null;

  function fieldPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return toField(event.clientX - rect.left, event.clientY - rect.top);
  }

  canvas.addEventListener('mousedown', (event) => {
    downAt = fieldPoint(event);
  });

  canvas.addEventListener('mousemove', (event) => {
    hover = fieldPoint(event);
  });

  canvas.addEventListener('mouseup', (event) => {
    if (!downAt) return;
    const up = fieldPoint(event);
    const moved = Math.hypot(up.x - downAt.x, up.y - downAt.y);
    if (moved < DRAG_MIN) clicks.push(up);
    else drags.push({ from: downAt, to: up });
    downAt = null;
  });

  canvas.addEventListener('mouseleave', () => {
    hover = null;
    downAt = null;
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    keys.push(event.code);
  });

  function takeClicks() {
    return clicks.splice(0, clicks.length);
  }

  function takeDrags() {
    return drags.splice(0, drags.length);
  }

  function takeKeys() {
    return keys.splice(0, keys.length);
  }

  function currentHover() {
    return hover;
  }

  return { takeClicks, takeDrags, takeKeys, currentHover };
}
