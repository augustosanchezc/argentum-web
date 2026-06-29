import type { Direction } from "@ao/shared";

// Primer pase de controles tactiles (T-049): D-pad de movimiento + boton de
// ataque, solo en dispositivos con puntero grueso (touch). El layout no busca
// ser perfecto, solo funcional en Chrome mobile.

export interface TouchControlsCallbacks {
  onDirDown(dir: Direction): void;
  onDirUp(dir: Direction): void;
  onAttack(): void;
}

export interface TouchControlsHandle {
  destroy(): void;
}

// Devuelve null en desktop (puntero fino): no montamos nada.
export function mountTouchControls(
  parent: HTMLElement,
  cb: TouchControlsCallbacks,
): TouchControlsHandle | null {
  const isCoarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  if (!isCoarse) return null;

  const wrap = document.createElement("div");
  wrap.className = "ao-touch";
  wrap.innerHTML = `
    <div class="ao-touch__dpad">
      <button class="ao-touch__btn ao-touch__btn--up"    data-dir="north" aria-label="Arriba">▲</button>
      <button class="ao-touch__btn ao-touch__btn--left"  data-dir="west"  aria-label="Izquierda">◀</button>
      <button class="ao-touch__btn ao-touch__btn--right" data-dir="east"  aria-label="Derecha">▶</button>
      <button class="ao-touch__btn ao-touch__btn--down"  data-dir="south" aria-label="Abajo">▼</button>
    </div>
    <button class="ao-touch__attack" aria-label="Atacar">⚔</button>
  `;
  parent.appendChild(wrap);

  const cleanups: Array<() => void> = [];

  const dirButtons = wrap.querySelectorAll<HTMLButtonElement>(".ao-touch__btn");
  dirButtons.forEach((btn) => {
    const dir = btn.dataset.dir as Direction;
    const down = (e: Event): void => {
      e.preventDefault();
      cb.onDirDown(dir);
    };
    const up = (e: Event): void => {
      e.preventDefault();
      cb.onDirUp(dir);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
    cleanups.push(() => {
      btn.removeEventListener("pointerdown", down);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointerleave", up);
      btn.removeEventListener("pointercancel", up);
    });
  });

  const attackBtn = wrap.querySelector<HTMLButtonElement>(".ao-touch__attack")!;
  const onAttackDown = (e: Event): void => {
    e.preventDefault();
    cb.onAttack();
  };
  attackBtn.addEventListener("pointerdown", onAttackDown);
  cleanups.push(() => {
    attackBtn.removeEventListener("pointerdown", onAttackDown);
  });

  return {
    destroy: () => {
      for (const c of cleanups) c();
      wrap.remove();
    },
  };
}
