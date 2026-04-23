import { type RaceId } from "./items";
import { type FactionForcePoolKind, type FactionForceShipRole } from "./factionForces";

export type FactionAssetType = "ship";
export type FactionAssetTag =
  | "assault"
  | "capture"
  | "command"
  | "defense"
  | "logistics"
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
  preferredUse: "defense" | "expansion" | "repair" | "patrol";
  strategicPriority: number;
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
    preferredUse: "patrol",
    strategicPriority: 3,
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
    preferredUse: "repair",
    strategicPriority: 2,
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
    preferredUse: "expansion",
    strategicPriority: 0,
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
    preferredUse: "defense",
    strategicPriority: 1,
    buildTimeMs: {
      zone: 46000,
      "prime-world": 32200,
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
