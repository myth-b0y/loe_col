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
  assert(initialSummary.production.primePools.some((pool) => pool.raceId === initialSummary.war.empireRaceId && pool.desiredReserveShips > 0),
    `Empire Prime World should be building reserve attack capacity: ${JSON.stringify(initialSummary.production.primePools)}`);
  assert(initialSummary.production.zonePoolSample.every((pool) => pool.desiredReserveShips === 0),
    `Zone pools should stay defense-only in this pass: ${JSON.stringify(initialSummary.production.zonePoolSample)}`);

  const naturalWarSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    for (let index = 0; index < 12; index += 1) {
      space.updateFactionWar(12000);
      space.updateForceProduction(30000);
      space.updateFactionWar(12000);
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
  assert(naturalWarSummary.empirePrimeAssignments.some((ship) => ship.assignmentKind === "invade"),
    `Empire Prime World reserve should launch invasion assignments: ${JSON.stringify(naturalWarSummary.empirePrimeAssignments)}`);
  assert(naturalWarSummary.republicTargets.length > 0 || naturalWarSummary.contestedZones.some((zone) => naturalWarSummary.war.republicRaceIds.includes(zone.captureAttackerRaceId)),
    `Republic-aligned races should be resisting or reclaiming against the Empire: ${JSON.stringify(naturalWarSummary)}`);

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

  const summary = {
    initialSummary,
    naturalWarSummary,
    hostilitySummary,
    neutralDefenseSummary,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}
