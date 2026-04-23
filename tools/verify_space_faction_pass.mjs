import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-faction-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function getState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? "{}");
  return JSON.parse(raw);
}

async function waitForScene(page, sceneKey, timeoutMs = 8000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const state = await getState(page);
    if (state.activeScene === sceneKey) {
      return state;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for scene '${sceneKey}'`);
}

async function waitForGameBootstrap(page, timeoutMs = 30000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const ready = await page.evaluate(() => Boolean(window.__loeGame) && typeof window.render_game_to_text === "function");
    if (ready) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error("Timed out waiting for game bootstrap");
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];

page.on("pageerror", (error) => {
  consoleErrors.push({ type: "pageerror", message: error.message, stack: error.stack });
});
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push({ type: "console", message: message.text() });
  }
});

try {
  await ensureDir(OUTPUT_DIR);
  await page.goto(URL, { waitUntil: "networkidle" });
  await waitForGameBootstrap(page);

  await page.evaluate(() => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    window.__loeGame?.scene.start("hub");
  });

  await waitForScene(page, "hub");
  await capture(page, "hub-start.png");

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.(null);
  });

  await waitForScene(page, "space");
  await page.waitForTimeout(400);
  await capture(page, "space-start.png");

  const initialSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const debug = space.getDebugSnapshot();
    const primePools = debug.production.pools.filter((pool) => pool.kind === "prime-world");
    const zonePools = debug.production.pools.filter((pool) => pool.kind === "zone");
    return {
      factionCounts: debug.factionCounts,
      worldFactionCounts: debug.worldFactionCounts,
      war: debug.war,
      production: {
        zoneShipPoolCap: debug.production.zoneShipPoolCap,
        primeWorldBaseShipPoolCap: debug.production.primeWorldBaseShipPoolCap,
        primeWorldZoneBonusPerControlledZone: debug.production.primeWorldZoneBonusPerControlledZone,
        startingZoneShips: debug.production.startingZoneShips,
        startingPrimeWorldShips: debug.production.startingPrimeWorldShips,
        primePools: primePools.map((pool) => ({
          raceId: pool.raceId,
          capacity: pool.capacity,
          desiredDefenseShips: pool.desiredDefenseShips,
          desiredReserveShips: pool.desiredReserveShips,
          activeShipCount: pool.activeShipCount,
          activeShips: pool.activeShips,
        })),
        zonePoolSample: zonePools.slice(0, 10).map((pool) => ({
          id: pool.id,
          raceId: pool.raceId,
          capacity: pool.capacity,
          desiredDefenseShips: pool.desiredDefenseShips,
          desiredReserveShips: pool.desiredReserveShips,
          activeShipCount: pool.activeShipCount,
        })),
      },
    };
  });

  assert(initialSummary.war.empireRaceId, `Empire race missing: ${JSON.stringify(initialSummary.war)}`);
  assert(Array.isArray(initialSummary.war.republicRaceIds) && initialSummary.war.republicRaceIds.length === 2,
    `Expected exactly two Republic-aligned races: ${JSON.stringify(initialSummary.war)}`);
  assert(!initialSummary.war.republicRaceIds.includes(initialSummary.war.empireRaceId),
    `Empire race should not also be Republic-aligned: ${JSON.stringify(initialSummary.war)}`);
  assert(initialSummary.factionCounts.empire > 0, `Empire fleets should exist in the first war-state pass: ${JSON.stringify(initialSummary.factionCounts)}`);
  assert(initialSummary.factionCounts.republic > 0, `Republic fleets should exist in the first war-state pass: ${JSON.stringify(initialSummary.factionCounts)}`);
  assert(initialSummary.factionCounts.homeguard > 0, `Neutral homeguard fleets should still exist: ${JSON.stringify(initialSummary.factionCounts)}`);
  assert(initialSummary.factionCounts.pirate > 0, `Pirates should remain as nuisance fleets: ${JSON.stringify(initialSummary.factionCounts)}`);
  assert(initialSummary.factionCounts.smuggler > 0, `Smugglers should remain active: ${JSON.stringify(initialSummary.factionCounts)}`);
  assert(initialSummary.production.zoneShipPoolCap === 5, `Zone pool cap must remain 5: ${JSON.stringify(initialSummary.production)}`);
  assert(initialSummary.production.primeWorldBaseShipPoolCap === 10, `Prime pool base cap must remain 10: ${JSON.stringify(initialSummary.production)}`);
  assert(initialSummary.production.primeWorldZoneBonusPerControlledZone === 1, `Prime zone bonus must remain +1 per controlled zone: ${JSON.stringify(initialSummary.production)}`);
  assert(initialSummary.production.startingZoneShips === 1, `Zone pools should start slower at 1 active ship: ${JSON.stringify(initialSummary.production)}`);
  assert(initialSummary.production.startingPrimeWorldShips === 5, `Prime Worlds should start at 5 active ships: ${JSON.stringify(initialSummary.production)}`);
  assert(initialSummary.production.primePools.some((pool) => pool.raceId === initialSummary.war.empireRaceId && pool.desiredReserveShips > 0),
    `Empire Prime World should be building reserve attack capacity: ${JSON.stringify(initialSummary.production.primePools)}`);
  assert(initialSummary.production.zonePoolSample.every((pool) => pool.desiredReserveShips === 0),
    `Zone pools should stay defense-only in this pass: ${JSON.stringify(initialSummary.production.zonePoolSample)}`);

  const naturalWarSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    for (let index = 0; index < 18; index += 1) {
      space.updateFactionWar(12000);
      space.updateForceProduction(30000);
      space.updateFactionWar(12000);
      const debug = space.getDebugSnapshot();
      const zoneCoreRaceBySectorId = Object.fromEntries(space.galaxyDefinition.homeworlds.map((homeworld) => [homeworld.sectorId, homeworld.raceId]));
      const empireRaceId = debug.war.empireRaceId;
      const empireHeldForeignZones = space.galaxyDefinition.zones.filter((zone) => (
        zone.currentControllerId === empireRaceId
        && zoneCoreRaceBySectorId[zone.coreSectorId] !== empireRaceId
      ));
      if (empireHeldForeignZones.length > 0 || debug.war.contestedZones.length > 0) {
        break;
      }
    }
    space.syncActiveWorld?.(true);
    const debug = space.getDebugSnapshot();
    const zoneCoreRaceBySectorId = Object.fromEntries(space.galaxyDefinition.homeworlds.map((homeworld) => [homeworld.sectorId, homeworld.raceId]));
    const empireRaceId = debug.war.empireRaceId;
    const empireHeldForeignZones = space.galaxyDefinition.zones.filter((zone) => (
      zone.currentControllerId === empireRaceId
      && zoneCoreRaceBySectorId[zone.coreSectorId] !== empireRaceId
    ));
    const republicTargets = debug.war.raceTargets.filter((raceState) => raceState.alignment === "republic" && raceState.activeTargetZoneId);
    const empirePrimePool = debug.production.pools.find((pool) => pool.kind === "prime-world" && pool.raceId === empireRaceId) ?? null;
    return {
      factionCounts: debug.factionCounts,
      war: debug.war,
      empireHeldForeignZoneCount: empireHeldForeignZones.length,
      contestedZones: debug.war.contestedZones,
      republicTargets,
      empirePrimeAssignments: empirePrimePool?.activeShips ?? [],
    };
  });

  await capture(page, "space-war-fast-forward.png");

  assert(naturalWarSummary.empireHeldForeignZoneCount > 0 || naturalWarSummary.contestedZones.length > 0,
    `Empire should be contesting or holding foreign territory after war fast-forward: ${JSON.stringify(naturalWarSummary)}`);
  assert(naturalWarSummary.empirePrimeAssignments.some((ship) => ship.assignmentKind === "invade" || ship.captureIntent === true || ship.fleetMode === "capture-force"),
    `Empire Prime World reserve should launch invasion assignments: ${JSON.stringify(naturalWarSummary.empirePrimeAssignments)}`);

  const republicResistanceSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const war = space.warState;
    const zoneCoreRaceBySectorId = Object.fromEntries(
      space.galaxyDefinition.homeworlds.map((homeworld) => [homeworld.sectorId, homeworld.raceId]),
    );
    const targetZone = space.galaxyDefinition.zones.find((zone) => (
      war.republicRaceIds.includes(zoneCoreRaceBySectorId[zone.coreSectorId])
      && !zone.isPrimeWorldZone
    )) ?? space.galaxyDefinition.zones.find((zone) => (
      war.republicRaceIds.includes(zoneCoreRaceBySectorId[zone.coreSectorId])
    ));
    if (!targetZone) {
      return null;
    }

    const ownerRaceId = zoneCoreRaceBySectorId[targetZone.coreSectorId];
    space.galaxyDefinition.zones.forEach((zone) => {
      zone.currentControllerId = zoneCoreRaceBySectorId[zone.coreSectorId];
      zone.zoneState = "stable";
      zone.zoneCaptureProgress = 0;
      zone.captureAttackerRaceId = null;
    });
    targetZone.currentControllerId = war.empireRaceId;
    war.raceStates.forEach((raceState) => {
      raceState.activeTargetZoneId = null;
      raceState.activeTargetZoneIds = [];
      raceState.retargetCooldownRemainingMs = 0;
    });

    let sawTargetingResponse = false;
    let sawReclaimAssignments = false;
    let sawFrontlineContest = false;
    let finalDebug = null;

    for (let index = 0; index < 14; index += 1) {
      space.updateFactionWar(12000);
      space.updateForceProduction(30000);
      space.updateFactionWar(12000);
      const debug = space.getDebugSnapshot();
      finalDebug = debug;
      const republicTargeting = debug.war.raceTargets.filter((raceState) => (
        war.republicRaceIds.includes(raceState.raceId) && raceState.activeTargetZoneId === targetZone.id
      ));
      if (republicTargeting.length > 0) {
        sawTargetingResponse = true;
      }
      const reclaimAssignments = debug.production.pools
        .filter((pool) => pool.kind === "prime-world" && war.republicRaceIds.includes(pool.raceId))
        .flatMap((pool) => pool.activeShips)
        .filter((ship) => ship.assignmentKind === "reclaim" && ship.assignmentZoneId === targetZone.id);
      if (reclaimAssignments.length > 0) {
        sawReclaimAssignments = true;
      }
      if (debug.war.contestedZones.some((zone) => zone.id === targetZone.id && war.republicRaceIds.includes(zone.captureAttackerRaceId))) {
        sawFrontlineContest = true;
      }
    }

    return {
      ownerRaceId,
      targetZoneId: targetZone.id,
      sawTargetingResponse,
      sawReclaimAssignments,
      sawFrontlineContest,
      finalControllerRaceId: (space.galaxyDefinition.zones.find((zone) => zone.id === targetZone.id)?.currentControllerId) ?? null,
      finalRaceTargets: finalDebug?.war?.raceTargets ?? [],
      finalContestedZones: finalDebug?.war?.contestedZones ?? [],
    };
  });

  assert(republicResistanceSummary, "Could not stage a Republic reclaim scenario");
  assert(
    republicResistanceSummary.sawTargetingResponse
    || republicResistanceSummary.sawReclaimAssignments
    || republicResistanceSummary.sawFrontlineContest
    || republicResistanceSummary.finalControllerRaceId === republicResistanceSummary.ownerRaceId,
    `Republic-aligned races should be resisting or reclaiming against the Empire: ${JSON.stringify(republicResistanceSummary)}`,
  );

  const hostilitySummary = await page.evaluate((cellSize) => {
    const space = window.__loeGame?.scene.keys.space;
    const playerX = space.shipRoot.x;
    const playerY = space.shipRoot.y;

    const stageShip = (predicate, x, y) => {
      const state = [...space.shipStates.values()].find((candidate) => !candidate.destroyed && predicate(candidate));
      if (!state) {
        return null;
      }

      state.x = x;
      state.y = y;
      state.velocityX = 0;
      state.velocityY = 0;
      state.patrolX = x;
      state.patrolY = y;
      state.aimX = 0;
      state.aimY = -1;
      state.provokedByPlayer = false;
      state.provokedByShips = [];
      state.aggressionTimer = 0;
      state.cellKey = `${Math.max(0, Math.floor(x / cellSize))},${Math.max(0, Math.floor(y / cellSize))}`;
      const activeShip = space.factionShips.find((ship) => ship.id === state.id);
      if (activeShip) {
        activeShip.root.x = x;
        activeShip.root.y = y;
        activeShip.velocity.set(0, 0);
        activeShip.patrolTarget.set(x, y);
        activeShip.aimDirection.set(0, -1);
        activeShip.provokedByPlayer = false;
        activeShip.provokedByShips.clear();
        activeShip.aggressionTimer = 0;
      }
      return state.id;
    };

    [...space.shipStates.values()].forEach((state, index) => {
      state.x = playerX + 5200 + (index * 10);
      state.y = playerY + 5200;
      state.velocityX = 0;
      state.velocityY = 0;
      state.patrolX = state.x;
      state.patrolY = state.y;
      state.cellKey = `${Math.max(0, Math.floor(state.x / cellSize))},${Math.max(0, Math.floor(state.y / cellSize))}`;
    });

    const empireId = stageShip((state) => state.factionId === "empire", playerX + 320, playerY);
    const republicId = stageShip((state) => state.factionId === "republic", playerX + 380, playerY + 120);
    const homeguardId = stageShip((state) => state.factionId === "homeguard", playerX + 420, playerY - 120);
    space.syncActiveWorld?.(true);

    const empire = space.factionShips.find((ship) => ship.id === empireId);
    const republic = space.factionShips.find((ship) => ship.id === republicId);
    const homeguard = space.factionShips.find((ship) => ship.id === homeguardId);
    if (!empire || !republic || !homeguard) {
      return null;
    }

    return {
      empireThreatensPlayer: space.isShipHostileToPlayer?.(empire) ?? false,
      republicThreatensPlayer: space.isShipHostileToPlayer?.(republic) ?? false,
      homeguardThreatensPlayer: space.isShipHostileToPlayer?.(homeguard) ?? false,
      empireVsRepublic: space.isShipHostileToShip(empire, republic),
      empireVsHomeguard: space.isShipHostileToShip(empire, homeguard),
      republicVsHomeguard: space.isShipHostileToShip(republic, homeguard),
    };
  }, 3200);

  assert(hostilitySummary, "Could not stage Empire/Republic/Homeguard ships for hostility checks");
  assert(hostilitySummary.empireThreatensPlayer, `Empire should threaten the player by default: ${JSON.stringify(hostilitySummary)}`);
  assert(!hostilitySummary.republicThreatensPlayer, `Republic should not attack the player by default: ${JSON.stringify(hostilitySummary)}`);
  assert(!hostilitySummary.homeguardThreatensPlayer, `Neutral homeguard should not attack the player by default: ${JSON.stringify(hostilitySummary)}`);
  assert(hostilitySummary.empireVsRepublic, `Empire should be hostile to Republic fleets: ${JSON.stringify(hostilitySummary)}`);
  assert(hostilitySummary.empireVsHomeguard, `Empire should be hostile to neutral homeguard fleets: ${JSON.stringify(hostilitySummary)}`);
  assert(!hostilitySummary.republicVsHomeguard, `Republic and neutral homeguard should not default to fighting each other: ${JSON.stringify(hostilitySummary)}`);

  const republicProtectionSummary = await page.evaluate((cellSize) => {
    const space = window.__loeGame?.scene.keys.space;
    const playerX = space.shipRoot.x;
    const playerY = space.shipRoot.y;

    const stageShip = (predicate, x, y) => {
      const state = [...space.shipStates.values()].find((candidate) => !candidate.destroyed && predicate(candidate));
      if (!state) {
        return null;
      }

      state.x = x;
      state.y = y;
      state.velocityX = 0;
      state.velocityY = 0;
      state.patrolX = x;
      state.patrolY = y;
      state.aimX = 0;
      state.aimY = -1;
      state.provokedByPlayer = false;
      state.provokedByShips = [];
      state.aggressionTimer = 0;
      state.cellKey = `${Math.max(0, Math.floor(x / cellSize))},${Math.max(0, Math.floor(y / cellSize))}`;
      const activeShip = space.factionShips.find((ship) => ship.id === state.id);
      if (activeShip) {
        activeShip.root.x = x;
        activeShip.root.y = y;
        activeShip.velocity.set(0, 0);
        activeShip.patrolTarget.set(x, y);
        activeShip.aimDirection.set(0, -1);
        activeShip.provokedByPlayer = false;
        activeShip.provokedByShips.clear();
        activeShip.aggressionTimer = 0;
      }
      return state.id;
    };

    const republicId = stageShip((state) => state.factionId === "republic", playerX + 320, playerY);
    space.syncActiveWorld?.(true);
    const republic = space.factionShips.find((ship) => ship.id === republicId);
    if (!republic) {
      return null;
    }

    const hpBefore = republic.hp;
    const canPlayerDamage = space.canPlayerDamageShip?.(republic) ?? true;
    space.damageFactionShip?.(republic, 1, { kind: "player" });
    return {
      shipId: republic.id,
      canPlayerDamage,
      hpBefore,
      hpAfter: republic.hp,
      threatensPlayer: space.canShipAttackPlayer?.(republic) ?? true,
      provokedByPlayer: republic.provokedByPlayer,
    };
  }, 3200);

  assert(republicProtectionSummary, "Could not stage a Republic ship for player-protection checks");
  assert(!republicProtectionSummary.canPlayerDamage, `Player should not be able to damage Republic ships: ${JSON.stringify(republicProtectionSummary)}`);
  assert(republicProtectionSummary.hpAfter === republicProtectionSummary.hpBefore, `Republic ships should ignore player damage attempts: ${JSON.stringify(republicProtectionSummary)}`);
  assert(!republicProtectionSummary.threatensPlayer, `Republic ships should never attack the player: ${JSON.stringify(republicProtectionSummary)}`);
  assert(!republicProtectionSummary.provokedByPlayer, `Republic ships should not become provoked by player damage attempts: ${JSON.stringify(republicProtectionSummary)}`);

  const neutralDefenseSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const war = space.warState;
    const zoneCoreRaceBySectorId = Object.fromEntries(space.galaxyDefinition.homeworlds.map((homeworld) => [homeworld.sectorId, homeworld.raceId]));
    const neutralRaceIds = war.raceStates
      .map((raceState) => raceState.raceId)
      .filter((raceId) => !war.republicRaceIds.includes(raceId) && raceId !== war.empireRaceId);
    const targetZone = space.galaxyDefinition.zones.find((zone) => neutralRaceIds.includes(zoneCoreRaceBySectorId[zone.coreSectorId]) && zone.currentControllerId === zoneCoreRaceBySectorId[zone.coreSectorId]);
    if (!targetZone) {
      return null;
    }

    const ownerRaceId = zoneCoreRaceBySectorId[targetZone.coreSectorId];
    targetZone.currentControllerId = war.empireRaceId;
    targetZone.zoneState = "stable";
    targetZone.zoneCaptureProgress = 0;
    targetZone.captureAttackerRaceId = null;
    let sawTargetingResponse = false;
    let sawReclaimAssignments = false;

    for (let index = 0; index < 8; index += 1) {
      space.updateFactionWar(12000);
      space.updateForceProduction(30000);
      space.updateFactionWar(12000);
      const raceState = space.warState.raceStates.find((candidate) => candidate.raceId === ownerRaceId) ?? null;
      const primePool = space.forceState.pools.find((pool) => pool.kind === "prime-world" && pool.raceId === ownerRaceId) ?? null;
      if (raceState?.activeTargetZoneId === targetZone.id) {
        sawTargetingResponse = true;
      }
      if ((primePool?.activeShips.filter((ship) => ship.assignmentKind === "reclaim" && ship.assignmentZoneId === targetZone.id).length ?? 0) > 0) {
        sawReclaimAssignments = true;
      }
    }

    const raceState = space.warState.raceStates.find((candidate) => candidate.raceId === ownerRaceId) ?? null;
    const primePool = space.forceState.pools.find((pool) => pool.kind === "prime-world" && pool.raceId === ownerRaceId) ?? null;
    return {
      ownerRaceId,
      targetZoneId: targetZone.id,
      activeTargetZoneId: raceState?.activeTargetZoneId ?? null,
      reclaimAssignments: primePool?.activeShips.filter((ship) => ship.assignmentKind === "reclaim").length ?? 0,
      sawTargetingResponse,
      sawReclaimAssignments,
      finalControllerRaceId: targetZone.currentControllerId,
    };
  });

  assert(neutralDefenseSummary, "Could not stage a neutral-zone defense scenario");
  assert(
    neutralDefenseSummary.activeTargetZoneId === neutralDefenseSummary.targetZoneId
    || neutralDefenseSummary.reclaimAssignments > 0
    || neutralDefenseSummary.sawTargetingResponse
    || neutralDefenseSummary.sawReclaimAssignments
    || neutralDefenseSummary.finalControllerRaceId === neutralDefenseSummary.ownerRaceId,
    `Neutral races should defend themselves when the Empire takes their zones: ${JSON.stringify(neutralDefenseSummary)}`);

  const contestedDefenseSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const war = space.warState;
    const zoneCoreRaceBySectorId = Object.fromEntries(space.galaxyDefinition.homeworlds.map((homeworld) => [homeworld.sectorId, homeworld.raceId]));
    const neutralRaceIds = war.raceStates
      .map((raceState) => raceState.raceId)
      .filter((raceId) => !war.republicRaceIds.includes(raceId) && raceId !== war.empireRaceId);
    const targetZone = space.galaxyDefinition.zones.find((zone) => (
      !zone.isPrimeWorldZone
      && neutralRaceIds.includes(zoneCoreRaceBySectorId[zone.coreSectorId])
      && zone.currentControllerId === zoneCoreRaceBySectorId[zone.coreSectorId]
    ));
    if (!targetZone) {
      return null;
    }

    const ownerRaceId = zoneCoreRaceBySectorId[targetZone.coreSectorId];
    targetZone.currentControllerId = ownerRaceId;
    targetZone.zoneState = "capturing";
    targetZone.zoneCaptureProgress = 0.42;
    targetZone.captureAttackerRaceId = war.empireRaceId;
    war.raceStates.forEach((raceState) => {
      if (raceState.raceId === ownerRaceId || war.republicRaceIds.includes(raceState.raceId) || raceState.raceId === war.empireRaceId) {
        raceState.activeTargetZoneId = null;
        raceState.retargetCooldownRemainingMs = 0;
      }
    });

    let ownerAidAssignments = 0;
    let republicAidAssignments = 0;

    for (let index = 0; index < 8; index += 1) {
      space.updateFactionWar(12000);
      space.updateForceProduction(30000);
      space.updateFactionWar(12000);
      const debug = space.getDebugSnapshot();
      const defendAssignments = debug.production.pools
        .flatMap((pool) => pool.activeShips.map((ship) => ({
          raceId: pool.raceId,
          assignmentKind: ship.assignmentKind,
          assignmentZoneId: ship.assignmentZoneId,
        })))
        .filter((ship) => ship.assignmentKind === "defend" && ship.assignmentZoneId === targetZone.id);
      ownerAidAssignments = Math.max(ownerAidAssignments, defendAssignments.filter((ship) => ship.raceId === ownerRaceId).length);
      republicAidAssignments = Math.max(republicAidAssignments, defendAssignments.filter((ship) => war.republicRaceIds.includes(ship.raceId)).length);
    }

    return {
      ownerRaceId,
      targetZoneId: targetZone.id,
      ownerAidAssignments,
      republicAidAssignments,
      finalControllerRaceId: targetZone.currentControllerId,
      finalZoneState: targetZone.zoneState,
    };
  });

  assert(contestedDefenseSummary, "Could not stage a contested-zone defense scenario");
  assert(contestedDefenseSummary.ownerAidAssignments > 0, `The owning faction should send defenders to contested zones: ${JSON.stringify(contestedDefenseSummary)}`);
  assert(contestedDefenseSummary.republicAidAssignments > 0, `Republic factions should help non-Empire zones under active Empire capture pressure: ${JSON.stringify(contestedDefenseSummary)}`);

  const contestedSpawnSuppressionSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const war = space.warState;
    const zoneCoreRaceBySectorId = Object.fromEntries(space.galaxyDefinition.homeworlds.map((homeworld) => [homeworld.sectorId, homeworld.raceId]));
    const targetZone = space.galaxyDefinition.zones.find((zone) => (
      !zone.isPrimeWorldZone
      && zoneCoreRaceBySectorId[zone.coreSectorId] !== war.empireRaceId
      && zone.currentControllerId === zoneCoreRaceBySectorId[zone.coreSectorId]
    ));
    if (!targetZone) {
      return null;
    }

    const ownerRaceId = zoneCoreRaceBySectorId[targetZone.coreSectorId];
    const pool = space.forceState.pools.find((candidate) => candidate.kind === "zone" && candidate.originZoneId === targetZone.id);
    if (!pool) {
      return null;
    }

    targetZone.currentControllerId = ownerRaceId;
    targetZone.zoneState = "capturing";
    targetZone.zoneCaptureProgress = 0.5;
    targetZone.captureAttackerRaceId = war.empireRaceId;
    pool.activeShips = [];
    pool.spawnCooldownRemainingMs = 0;
    pool.desiredDefenseShips = 3;
    pool.desiredReserveShips = 0;

    space.updateFactionWar(12000);
    space.updateForceProduction(30000);

    return {
      targetZoneId: targetZone.id,
      activeShipCount: pool.activeShips.length,
      desiredDefenseShips: pool.desiredDefenseShips,
      spawnCooldownRemainingMs: pool.spawnCooldownRemainingMs,
    };
  });

  assert(contestedSpawnSuppressionSummary, "Could not stage a contested-zone spawn-suppression scenario");
  assert(contestedSpawnSuppressionSummary.activeShipCount === 0, `Contested local zones should not instantly respawn new defenders: ${JSON.stringify(contestedSpawnSuppressionSummary)}`);

  const captureCompletionSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const war = space.warState;
    const zoneCoreRaceBySectorId = Object.fromEntries(space.galaxyDefinition.homeworlds.map((homeworld) => [homeworld.sectorId, homeworld.raceId]));
    const targetZone = space.galaxyDefinition.zones.find((zone) => {
      if (zone.isPrimeWorldZone) {
        return false;
      }
      if (zoneCoreRaceBySectorId[zone.coreSectorId] === war.empireRaceId) {
        return false;
      }
      if (zone.currentControllerId !== zoneCoreRaceBySectorId[zone.coreSectorId]) {
        return false;
      }
      return (space.zoneAdjacency?.[zone.id] ?? []).some((adjacentZoneId) => {
        const adjacentZone = space.galaxyDefinition.zones.find((candidate) => candidate.id === adjacentZoneId);
        return adjacentZone?.currentControllerId === war.empireRaceId;
      });
    });
    if (!targetZone) {
      return null;
    }

    const defenderRaceId = zoneCoreRaceBySectorId[targetZone.coreSectorId];
    targetZone.currentControllerId = defenderRaceId;
    targetZone.zoneState = "stable";
    targetZone.zoneCaptureProgress = 0;
    targetZone.captureAttackerRaceId = null;

    space.forceState.pools.forEach((pool) => {
      if (pool.raceId !== war.empireRaceId) {
        pool.activeShips = [];
        pool.spawnCooldownRemainingMs = 999999;
      }
    });

    const empirePrimePool = space.forceState.pools.find((pool) => pool.kind === "prime-world" && pool.raceId === war.empireRaceId);
    const empireRaceState = war.raceStates.find((raceState) => raceState.raceId === war.empireRaceId);
    if (!empirePrimePool || !empireRaceState) {
      return null;
    }

    empireRaceState.activeTargetZoneId = targetZone.id;
    empireRaceState.activeTargetZoneIds = [targetZone.id];
    empireRaceState.retargetCooldownRemainingMs = 999999;
    empirePrimePool.activeShips = Array.from({ length: 12 }, (_value, index) => ({
      id: `verify-capture:${index + 1}`,
      assetId: index === 0 || index === 4
        ? "ship/attack-warship"
        : index === 1
          ? "ship/support-fighter"
          : index === 2
            ? "ship/defense-warship"
            : "ship/base-fighter",
      role: index === 0 || index === 4
        ? "attack-warship"
        : index === 1
          ? "support-fighter"
          : index === 2
            ? "defense-warship"
            : "base-fighter",
      assignmentKind: "invade",
      assignmentZoneId: targetZone.id,
      slotKind: index === 0 ? "command" : "escort",
      fleetId: "verify-capture-fleet",
      fleetGroupId: null,
      fleetMode: "capture-force",
      travelFromSystemId: empirePrimePool.originSystemId,
      travelToSystemId: targetZone.systemId,
      travelProgress: 1,
      captureIntent: index === 0 || index === 4 || index === 2,
    }));
    empirePrimePool.nextShipSerial = 13;
    empirePrimePool.spawnCooldownRemainingMs = 0;

    for (let index = 0; index < 5; index += 1) {
      space.updateFactionWar(20000);
    }

    window.__loeSession?.setGalaxyDefinition?.(space.galaxyDefinition);
    window.__loeSession?.setFactionWarState?.(space.warState);
    window.__loeSession?.setFactionForceState?.(space.forceState);

    const overlay = space.galaxyMapOverlay;
    overlay?.show?.();
    if (overlay) {
      overlay.selectedSectorId = targetZone.sectorId;
      overlay.refresh(true);
    }

    const sessionZone = window.__loeSession?.getGalaxyDefinition?.()?.zones?.find?.((zone) => zone.id === targetZone.id) ?? null;
    return {
      targetZoneId: targetZone.id,
      targetZoneName: targetZone.name,
      sectorId: targetZone.sectorId,
      finalControllerRaceId: targetZone.currentControllerId,
      sessionControllerRaceId: sessionZone?.currentControllerId ?? null,
      capturedByEmpire: targetZone.currentControllerId === war.empireRaceId,
      overlayVisible: overlay?.isVisible?.() ?? false,
      mapDebug: overlay?.getDebugSnapshot?.() ?? null,
    };
  });

  await page.waitForTimeout(180);
  await capture(page, "space-capture-map.png");

  assert(captureCompletionSummary, "Could not stage an end-to-end zone capture scenario");
  assert(captureCompletionSummary.capturedByEmpire, `Empire capture should complete end-to-end: ${JSON.stringify(captureCompletionSummary)}`);
  assert(captureCompletionSummary.sessionControllerRaceId === captureCompletionSummary.finalControllerRaceId,
    `Captured zone controller should sync back into session data: ${JSON.stringify(captureCompletionSummary)}`);
  assert(captureCompletionSummary.overlayVisible, `Space datapad map should be visible for capture verification: ${JSON.stringify(captureCompletionSummary)}`);
  assert(captureCompletionSummary.mapDebug?.selectedSectorId === captureCompletionSummary.sectorId,
    `Sector-detail map should be focused on the captured zone's sector: ${JSON.stringify(captureCompletionSummary)}`);

  const summary = {
    initialSummary,
    naturalWarSummary,
    republicResistanceSummary,
    hostilitySummary,
    republicProtectionSummary,
    neutralDefenseSummary,
    contestedDefenseSummary,
    contestedSpawnSuppressionSummary,
    captureCompletionSummary,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}
