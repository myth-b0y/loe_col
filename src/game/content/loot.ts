import {
  DEFAULT_CRAFTING_MATERIALS,
  addCraftingMaterials,
  createLegendarySetPiece,
  createProceduralBossGear,
  describeCraftingMaterials,
  type CraftingMaterials,
  type InventoryItem,
  type RaceId,
} from "./items";

export type MissionRewardPreview = {
  xp: number;
  dropLines: string[];
  salvageLine: string;
};

export type MissionRewardBundle = {
  credits: number;
  xp: number;
  materials: CraftingMaterials;
  items: InventoryItem[];
};

export type EnemyDropBundle = {
  credits: number;
  materials: CraftingMaterials;
};

type MissionBossLootPlan = {
  missionId: string;
  legendaryPiece: "head" | "chest" | "legs";
  bonusSlot: "belt" | "weapon" | "back";
};

const BOSS_LOOT_PLANS: Record<string, MissionBossLootPlan> = {
  "ember-watch": {
    missionId: "ember-watch",
    legendaryPiece: "chest",
    bonusSlot: "belt",
  },
  "outpost-breach": {
    missionId: "outpost-breach",
    legendaryPiece: "legs",
    bonusSlot: "weapon",
  },
  "nightglass-abyss": {
    missionId: "nightglass-abyss",
    legendaryPiece: "head",
    bonusSlot: "back",
  },
};

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(min + (max - min + 1) * this.next());
  }
}

export function getMissionRewardPreview(missionId: string, xp: number): MissionRewardPreview {
  const plan = BOSS_LOOT_PLANS[missionId] ?? BOSS_LOOT_PLANS["ember-watch"];
  const legendaryLabel = plan.legendaryPiece === "head"
    ? "Legendary Helm"
    : plan.legendaryPiece === "chest"
      ? "Legendary Chest"
      : "Legendary Legs";
  const bonusLabel = plan.bonusSlot === "belt"
    ? "Procedural Belt"
    : plan.bonusSlot === "weapon"
      ? "Procedural Weapon"
      : "Procedural Cape";

  return {
    xp,
    dropLines: [`Boss Cache: ${legendaryLabel}`, `Bonus Drop: ${bonusLabel}`],
    salvageLine: "Field salvage: enemy credits + crafting materials",
  };
}

export function buildMissionRewardBundle(options: {
  missionId: string;
  difficulty: "easy" | "medium" | "hard";
  raceId: RaceId;
  xp: number;
  credits: number;
  materials: CraftingMaterials;
  seed: number;
}): MissionRewardBundle {
  const plan = BOSS_LOOT_PLANS[options.missionId] ?? BOSS_LOOT_PLANS["ember-watch"];

  const items: InventoryItem[] = [
    createLegendarySetPiece(plan.legendaryPiece, options.raceId, options.seed ^ 0x5a11a7),
    createProceduralBossGear(plan.bonusSlot, options.raceId, options.difficulty, options.seed ^ 0x1c77b9),
  ];

  return {
    credits: options.credits,
    xp: options.xp,
    materials: { ...DEFAULT_CRAFTING_MATERIALS, ...options.materials },
    items,
  };
}

export function buildEnemyDropBundle(kind: "rusher" | "shooter" | "hexer" | "boss", difficulty: "easy" | "medium" | "hard", seed: number): EnemyDropBundle {
  const rng = new SeededRandom(seed ^ hashString(`${kind}-${difficulty}`));
  const base = difficulty === "easy" ? 1 : difficulty === "medium" ? 1.25 : 1.55;

  if (kind === "boss") {
    return {
      credits: 0,
      materials: { ...DEFAULT_CRAFTING_MATERIALS },
    };
  }

  const credits = kind === "rusher"
    ? rng.int(6, 10)
    : kind === "shooter"
      ? rng.int(7, 11)
      : rng.int(9, 13);

  const materials = { ...DEFAULT_CRAFTING_MATERIALS };
  if (kind === "rusher") {
    materials.alloy += rng.int(0, Math.round(1 * base));
  } else if (kind === "shooter") {
    materials.filament += rng.int(0, Math.round(1 * base));
    materials.alloy += rng.int(0, 1);
  } else {
    materials.shardDust += rng.int(1, Math.max(1, Math.round(1.4 * base)));
    materials.filament += rng.int(0, 1);
  }

  return {
    credits,
    materials,
  };
}

export function describeRewardBundle(reward: MissionRewardBundle): string[] {
  const lines = [`+${reward.xp} XP`, `+${reward.credits} Credits`];
  lines.push(...describeCraftingMaterials(reward.materials));
  reward.items.forEach((item) => {
    lines.push(item.name);
  });
  return lines;
}

export function addRewardMaterials(base: CraftingMaterials, reward: Partial<CraftingMaterials>): CraftingMaterials {
  return addCraftingMaterials(base, reward);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
