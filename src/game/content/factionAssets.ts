import { type RaceId } from "./items";
import { type FactionForcePoolKind, type FactionForceShipRole, type FactionResourceType } from "./factionForces";

export type FactionAssetType = "ship";
export type FactionAssetTag =
  | "assault"
  | "capture"
  | "command"
  | "defense"
  | "logistics"
  | "mining"
  | "patrol"
  | "reinforce"
  | "repair"
  | "scout"
  | "siege"
  | "support";

export type FactionAssetBuildLocationRule = "prime-world" | "system";

export type FactionAssetDefinition = {
  id: string;
  assetType: FactionAssetType;
  shipRole: FactionForceShipRole;
  role: string;
  tags: readonly FactionAssetTag[];
  factionAccess: "all-main-races";
  raceCompatibility: readonly RaceId[] | "all-main-races";
  combatValue: number;
  threatValue: number;
  defenseValue: number;
  mobilityValue: number;
  durability: number;
  costPlaceholder: number;
  buildLocationRules: readonly FactionAssetBuildLocationRule[];
  formationEligible: boolean;
  canCommand: boolean;
  canCapture: boolean;
  effectiveRadius: number;
  supportRadius: number;
  cargoCapacity: number;
  preferredUse: "defense" | "expansion" | "repair" | "patrol" | "mining";
  strategicPriority: number;
  resourceCost: Partial<Record<FactionResourceType, number>>;
  buildTimeMs: {
    zone: number;
    "prime-world": number;
  };
};

export const FACTION_ASSET_DEFINITIONS: readonly FactionAssetDefinition[] = [
  {
    id: "ship/base-fighter",
    assetType: "ship",
    shipRole: "base-fighter",
    role: "common combat ship",
    tags: ["assault", "patrol", "reinforce"],
    factionAccess: "all-main-races",
    raceCompatibility: "all-main-races",
    combatValue: 1,
    threatValue: 1,
    defenseValue: 0.95,
    mobilityValue: 1.18,
    durability: 1,
    costPlaceholder: 1,
    buildLocationRules: ["prime-world", "system"],
    formationEligible: true,
    canCommand: false,
    canCapture: false,
    effectiveRadius: 580,
    supportRadius: 0,
    cargoCapacity: 0,
    preferredUse: "patrol",
    strategicPriority: 3,
    resourceCost: {
      "iron-ore": 16,
      "scrap-ship-parts": 6,
    },
    buildTimeMs: {
      zone: 24000,
      "prime-world": 16800,
    },
  },
  {
    id: "ship/support-fighter",
    assetType: "ship",
    shipRole: "support-fighter",
    role: "fleet sustain ship",
    tags: ["support", "repair", "reinforce", "patrol"],
    factionAccess: "all-main-races",
    raceCompatibility: "all-main-races",
    combatValue: 0.9,
    threatValue: 0.88,
    defenseValue: 1.02,
    mobilityValue: 1.04,
    durability: 0.92,
    costPlaceholder: 2,
    buildLocationRules: ["prime-world", "system"],
    formationEligible: true,
    canCommand: false,
    canCapture: false,
    effectiveRadius: 620,
    supportRadius: 270,
    cargoCapacity: 0,
    preferredUse: "repair",
    strategicPriority: 2,
    resourceCost: {
      "iron-ore": 18,
      "scrap-ship-parts": 8,
      "aetherium-ore": 2,
    },
    buildTimeMs: {
      zone: 30000,
      "prime-world": 21000,
    },
  },
  {
    id: "ship/attack-warship",
    assetType: "ship",
    shipRole: "attack-warship",
    role: "heavy assault command ship",
    tags: ["assault", "capture", "command", "siege"],
    factionAccess: "all-main-races",
    raceCompatibility: "all-main-races",
    combatValue: 1.7,
    threatValue: 1.85,
    defenseValue: 1.2,
    mobilityValue: 0.84,
    durability: 1.7,
    costPlaceholder: 4,
    buildLocationRules: ["prime-world", "system"],
    formationEligible: true,
    canCommand: true,
    canCapture: true,
    effectiveRadius: 760,
    supportRadius: 0,
    cargoCapacity: 24,
    preferredUse: "expansion",
    strategicPriority: 0,
    resourceCost: {
      "iron-ore": 36,
      "aetherium-ore": 8,
      "starforged-alloy": 1,
    },
    buildTimeMs: {
      zone: 52000,
      "prime-world": 36400,
    },
  },
  {
    id: "ship/defense-warship",
    assetType: "ship",
    shipRole: "defense-warship",
    role: "heavy defensive line ship",
    tags: ["command", "defense", "reinforce"],
    factionAccess: "all-main-races",
    raceCompatibility: "all-main-races",
    combatValue: 1.35,
    threatValue: 1.42,
    defenseValue: 1.8,
    mobilityValue: 0.76,
    durability: 1.95,
    costPlaceholder: 4,
    buildLocationRules: ["prime-world", "system"],
    formationEligible: true,
    canCommand: true,
    canCapture: true,
    effectiveRadius: 720,
    supportRadius: 0,
    cargoCapacity: 30,
    preferredUse: "defense",
    strategicPriority: 1,
    resourceCost: {
      "iron-ore": 30,
      "scrap-ship-parts": 12,
      "aetherium-ore": 6,
    },
    buildTimeMs: {
      zone: 46000,
      "prime-world": 32200,
    },
  },
  {
    id: "ship/miner-ship",
    assetType: "ship",
    shipRole: "miner-ship",
    role: "industrial miner ship",
    tags: ["logistics", "mining", "patrol"],
    factionAccess: "all-main-races",
    raceCompatibility: "all-main-races",
    combatValue: 0.2,
    threatValue: 0.12,
    defenseValue: 0.48,
    mobilityValue: 0.92,
    durability: 0.82,
    costPlaceholder: 1,
    buildLocationRules: ["prime-world", "system"],
    formationEligible: false,
    canCommand: false,
    canCapture: false,
    effectiveRadius: 380,
    supportRadius: 0,
    cargoCapacity: 18,
    preferredUse: "mining",
    strategicPriority: 4,
    resourceCost: {},
    buildTimeMs: {
      zone: 22000,
      "prime-world": 16800,
    },
  },
] as const;

const ASSET_BY_ID = new Map(FACTION_ASSET_DEFINITIONS.map((asset) => [asset.id, asset] as const));
const ASSET_BY_SHIP_ROLE = new Map(FACTION_ASSET_DEFINITIONS.map((asset) => [asset.shipRole, asset] as const));

export function getFactionAssetDefinition(assetId: string): FactionAssetDefinition {
  return ASSET_BY_ID.get(assetId) ?? ASSET_BY_SHIP_ROLE.get("base-fighter")!;
}

export function getFactionAssetDefinitionForShipRole(role: FactionForceShipRole): FactionAssetDefinition {
  return ASSET_BY_SHIP_ROLE.get(role) ?? ASSET_BY_SHIP_ROLE.get("base-fighter")!;
}

export function getFactionAssetBuildTimeMs(poolKind: FactionForcePoolKind, assetId: string): number {
  const asset = getFactionAssetDefinition(assetId);
  return asset.buildTimeMs[poolKind];
}

export function getFactionAssetTags(assetId: string): readonly FactionAssetTag[] {
  return getFactionAssetDefinition(assetId).tags;
}

export function isFactionAssetCommandEligible(assetId: string): boolean {
  return getFactionAssetDefinition(assetId).canCommand;
}

export function isFactionAssetCaptureEligible(assetId: string): boolean {
  return getFactionAssetDefinition(assetId).canCapture;
}

export function getFactionAssetWarPower(assetId: string): number {
  return getFactionAssetDefinition(assetId).combatValue;
}

export function getFactionAssetDefenseValue(assetId: string): number {
  return getFactionAssetDefinition(assetId).defenseValue;
}

export function getFactionAssetMobilityValue(assetId: string): number {
  return getFactionAssetDefinition(assetId).mobilityValue;
}

export function getFactionAssetStrategicPriority(assetId: string): number {
  return getFactionAssetDefinition(assetId).strategicPriority;
}

export function getFactionAssetPreferredUse(assetId: string): FactionAssetDefinition["preferredUse"] {
  return getFactionAssetDefinition(assetId).preferredUse;
}

export function getFactionAssetShipRole(assetId: string): FactionForceShipRole {
  return getFactionAssetDefinition(assetId).shipRole;
}

export function getFactionAssetResourceCost(assetId: string): Partial<Record<FactionResourceType, number>> {
  return { ...getFactionAssetDefinition(assetId).resourceCost };
}

export function getFactionAssetCargoCapacity(assetId: string): number {
  return Math.max(0, Math.round(getFactionAssetDefinition(assetId).cargoCapacity));
}
