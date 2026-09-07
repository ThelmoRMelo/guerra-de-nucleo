// Estado de entrada compartilhado entre DOM (teclado, mouse, toque) e o loop 3D.

export const input = {
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  pitch: -0.12,
  shooting: false,
  reloadPulse: false,
  interactPulse: false,
  sensitivity: 1,
  touch: false,
  // true = o mouse/teclado pertencem à interface (loja), não ao jogo 3D
  uiMode: false,
};

const keys = new Set<string>();

function axisFromKeys() {
  if (input.uiMode) {
    input.moveX = 0;
    input.moveZ = 0;
    return;
  }
  input.moveX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  input.moveZ = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
}

let lockTarget: HTMLElement | null = null;

/** Alterna entre GAME MODE e MERCHANT MODE (mouse livre para a interface). */
export function setUiMode(active: boolean) {
  input.uiMode = active;
  if (active) {
    keys.clear();
    input.moveX = 0;
    input.moveZ = 0;
    input.shooting = false;
    input.reloadPulse = false;
    if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock?.();
  } else if (!input.touch && lockTarget) {
    try {
      lockTarget.requestPointerLock?.();
    } catch {
      /* o navegador pode exigir um novo clique */
    }
  }
}

export function setJoystick(x: number, z: number) {
  if (input.uiMode) return;
  input.moveX = x;
  input.moveZ = z;
}

export function addLook(dx: number, dy: number) {
  if (input.uiMode) return;
  input.yaw -= dx * 0.0022 * input.sensitivity;
  input.pitch = Math.max(-0.9, Math.min(0.55, input.pitch - dy * 0.0018 * input.sensitivity));
}


export function attachDesktopInput(target: HTMLElement, onEscape: () => void) {
  lockTarget = target;
  const onDown = (e: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape") {
      onEscape();
      return;
    }
    if (e.code === "KeyE") {
      input.interactPulse = true;
      return;
    }
    if (input.uiMode) return;
    if (e.code === "KeyR") input.reloadPulse = true;
    keys.add(e.code);
    axisFromKeys();
  };
  const onUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
    axisFromKeys();
  };
  const onMouseDown = (e: MouseEvent) => {
    if (input.uiMode) return;
    if (e.button === 0) {
      input.shooting = true;
      if (document.pointerLockElement !== target) target.requestPointerLock?.();
    }
  };
  const onMouseUp = () => {
    input.shooting = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    if (input.uiMode) return;
    if (document.pointerLockElement === target) addLook(e.movementX, e.movementY);
  };
  const onBlur = () => {
    keys.clear();
    axisFromKeys();
    input.shooting = false;
  };


  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  target.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("blur", onBlur);
  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    target.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("blur", onBlur);
    if (lockTarget === target) lockTarget = null;
  };
}


export function resetInput() {
  keys.clear();
  input.uiMode = false;
  input.moveX = 0;
  input.moveZ = 0;
  input.shooting = false;
  input.reloadPulse = false;

  input.interactPulse = false;
}
