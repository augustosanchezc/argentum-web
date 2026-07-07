import type { SkillDef } from "@ao/shared";

export interface SkillHotbarHandle {
  setSkill(skill: SkillDef | undefined): void;
  startCooldown(durationMs: number): void;
  destroy(): void;
}

export function mountSkillHotbar(parent: HTMLElement): SkillHotbarHandle {
  const bar = document.createElement("div");
  bar.className = "ao-skill-hotbar";

  const slot = document.createElement("div");
  slot.className = "ao-skill-slot ao-skill-slot--empty";

  const keyEl = document.createElement("div");
  keyEl.className = "ao-skill-slot__key";
  keyEl.textContent = "1";

  const nameEl = document.createElement("div");
  nameEl.className = "ao-skill-slot__name";

  const cdEl = document.createElement("div");
  cdEl.className = "ao-skill-slot__cd";

  slot.append(keyEl, nameEl, cdEl);
  bar.appendChild(slot);
  parent.appendChild(bar);

  let cdInterval: ReturnType<typeof setInterval> | null = null;

  function setSkill(skill: SkillDef | undefined): void {
    if (!skill) {
      slot.classList.add("ao-skill-slot--empty");
      nameEl.textContent = "";
      slot.title = "";
      return;
    }
    slot.classList.remove("ao-skill-slot--empty");
    nameEl.textContent = skill.name;
    slot.title = `${skill.name}: ${skill.description}\nMP: ${skill.mpCost.toString()}, CD: ${(skill.cooldownMs / 1000).toFixed(1)}s`;
  }

  function startCooldown(durationMs: number): void {
    const start = performance.now();
    cdEl.style.height = "100%";
    slot.classList.add("ao-skill-slot--cooling");
    if (cdInterval) clearInterval(cdInterval);
    cdInterval = setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.max(0, 1 - elapsed / durationMs);
      cdEl.style.height = `${(pct * 100).toFixed(1)}%`;
      if (pct <= 0) {
        if (cdInterval) clearInterval(cdInterval);
        cdInterval = null;
        slot.classList.remove("ao-skill-slot--cooling");
      }
    }, 40);
  }

  return {
    setSkill,
    startCooldown,
    destroy() {
      if (cdInterval) clearInterval(cdInterval);
      bar.remove();
    },
  };
}
