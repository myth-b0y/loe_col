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
  await page.waitForFunction(() => Boolean(window.__loeGame) && typeof window.render_game_to_text === "function");

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
  await page.waitForTimeout(300);
  await capture(page, "space-start.png");

  const spawnSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const ships = [...space.worldDefinition.factionSeeds];
    const debugSnapshot = space.getDebugSnapshot();
    const groupSizes = ships.reduce((acc, ship) => {
      const key = `${ship.factionId}:${ship.groupId}`;
      if (!acc[key]) {
        acc[key] = { factionId: ship.factionId, size: 0, leaders: 0 };
      }
      acc[key].size += 1;
      if (!ship.leaderId) {
        acc[key].leaders += 1;
      }
      return acc;
    }, {});
    const sectorCounts = ships.reduce((acc, ship) => {
      if (!acc[ship.sectorId]) {
        acc[ship.sectorId] = { empire: 0, republic: 0, pirate: 0, smuggler: 0, homeguard: 0 };
      }
      acc[ship.sectorId][ship.factionId] += 1;
      return acc;
    }, {});
    const homeguardStates = [...space.shipStates.values()].filter((state) => state.factionId === "homeguard" && state.originRaceId && !state.destroyed);
    const homeguardRaceCounts = homeguardStates.reduce((acc, state) => {
      acc[state.originRaceId] = (acc[state.originRaceId] ?? 0) + 1;
      return acc;
    }, {});
    const homeguardRoleCounts = homeguardStates.reduce((acc, state) => {
      const roleKey = state.shipRole ?? "unknown";
      acc[roleKey] = (acc[roleKey] ?? 0) + 1;
      return acc;
    }, {});
    const homeguardRaceSamples = homeguardStates.reduce((acc, state) => {
      if (!acc[state.originRaceId]) {
        acc[state.originRaceId] = { count: 0, maxHp: state.maxHp, guardRadiusTotal: 0 };
      }
      acc[state.originRaceId].count += 1;
      acc[state.originRaceId].maxHp = Math.max(acc[state.originRaceId].maxHp, state.maxHp);
      acc[state.originRaceId].guardRadiusTotal += state.guardRadius ?? 0;
      return acc;
    }, {});
    Object.values(homeguardRaceSamples).forEach((sample) => {
      sample.averageGuardRadius = sample.count > 0 ? Math.round(sample.guardRadiusTotal / sample.count) : 0;
      delete sample.guardRadiusTotal;
    });
    return {
      factionCounts: debugSnapshot.factionCounts,
      sectorCounts,
      shipCount: ships.length,
      groupSizes: Object.values(groupSizes),
      production: debugSnapshot.production,
      homeguardRaceCounts,
      homeguardRoleCounts,
      homeguardRaceSamples,
    };
  });

  assert(spawnSummary.factionCounts.empire === 0, `Empire ships should be absent in the neutral baseline: ${JSON.stringify(spawnSummary.factionCounts)}`);
  assert(spawnSummary.factionCounts.republic === 0, `Republic ships should be absent in the neutral baseline: ${JSON.stringify(spawnSummary.factionCounts)}`);
  assert(spawnSummary.factionCounts.pirate > 0, "Pirate nuisance fleets did not spawn");
  assert(spawnSummary.factionCounts.smuggler > 0, "Smugglers did not spawn");
  assert(spawnSummary.factionCounts.homeguard > 0, "Prime world guardian fleets did not spawn");
  assert(spawnSummary.shipCount >= 180, `Neutral defensive baseline ship population is unexpectedly low: ${spawnSummary.shipCount}`);
  assert(Object.keys(spawnSummary.sectorCounts).length >= 7, `Expected faction seeds across all sectors: ${JSON.stringify(spawnSummary.sectorCounts)}`);
  assert(spawnSummary.groupSizes.every((group) => group.leaders === 1), "Every faction group should still have exactly one leader");
  assert(spawnSummary.groupSizes.filter((group) => group.factionId === "pirate").every((group) => group.size >= 2 && group.size <= 3),
    `Pirate groups should remain 2-3 ship nuisance packs: ${JSON.stringify(spawnSummary.groupSizes.filter((group) => group.factionId === "pirate"))}`);
  assert(spawnSummary.groupSizes.filter((group) => group.factionId === "smuggler").every((group) => group.size === 1),
    `Smuggler groups should remain solo routes: ${JSON.stringify(spawnSummary.groupSizes.filter((group) => group.factionId === "smuggler"))}`);
  assert(spawnSummary.groupSizes.filter((group) => group.factionId === "homeguard").every((group) => group.size >= 1 && group.size <= 4),
    `Home guard groups should remain compact local formations: ${JSON.stringify(spawnSummary.groupSizes.filter((group) => group.factionId === "homeguard"))}`);
  assert(spawnSummary.production, "Production snapshot missing from debug state");
  assert(spawnSummary.production.zoneShipPoolCap === 5, `Zone ship pool cap should be 5: ${JSON.stringify(spawnSummary.production)}`);
  assert(spawnSummary.production.primeWorldBaseShipPoolCap === 10, `Prime world base ship pool cap should be 10: ${JSON.stringify(spawnSummary.production)}`);
  assert(spawnSummary.production.primeWorldZoneBonusPerControlledZone === 1, `Prime world zone bonus should be +1 per controlled zone: ${JSON.stringify(spawnSummary.production)}`);
  const zonePools = spawnSummary.production.pools.filter((pool) => pool.kind === "zone");
  const primePools = spawnSummary.production.pools.filter((pool) => pool.kind === "prime-world");
  assert(zonePools.length === spawnSummary.production.totalPools - primePools.length && zonePools.length > 0, `Zone pools should exist for controlled systems: ${JSON.stringify(spawnSummary.production)}`);
  assert(primePools.length === 7, `Expected one prime-world pool per race: ${JSON.stringify(spawnSummary.production)}`);
  assert(zonePools.every((pool) => pool.capacity === 5), `Every controlled zone should expose a local 5-ship pool: ${JSON.stringify(zonePools)}`);
  assert(primePools.every((pool) => pool.capacity === 10 + pool.controlledZoneCount), `Prime world capacity should equal 10 plus controlled zones: ${JSON.stringify(primePools)}`);
  assert(primePools.every((pool) => pool.activeShipCount === 3 && pool.desiredDefenseShips === 3), `Prime world defense should be filled first to 3 ships in this baseline: ${JSON.stringify(primePools)}`);
  assert(zonePools.every((pool) => pool.desiredDefenseShips === 3), `Zone defense target should now be 3 ships per controlled zone: ${JSON.stringify(zonePools.slice(0, 8))}`);
  assert(zonePools.every((pool) => pool.activeShipCount >= 1 && pool.activeShipCount <= 3), `Zone defense pools should actively begin filling toward 3 ships: ${JSON.stringify(zonePools.slice(0, 8))}`);
  assert(Object.keys(spawnSummary.homeguardRaceCounts).length === 7, `Home guard defenders should exist for all seven races: ${JSON.stringify(spawnSummary.homeguardRaceCounts)}`);
  assert(Object.values(spawnSummary.homeguardRaceCounts).every((count) => count >= 3), `Each race should have multiple defender ships active in the force state: ${JSON.stringify(spawnSummary.homeguardRaceCounts)}`);
  assert(spawnSummary.homeguardRoleCounts["base-fighter"] > 0, `Base fighters should be present in defensive fleets: ${JSON.stringify(spawnSummary.homeguardRoleCounts)}`);
  assert(spawnSummary.homeguardRoleCounts["support-fighter"] > 0, `Support fighters should be present in defensive fleets: ${JSON.stringify(spawnSummary.homeguardRoleCounts)}`);
  assert(spawnSummary.homeguardRoleCounts["attack-warship"] > 0, `Attack warships should be present in defensive fleets: ${JSON.stringify(spawnSummary.homeguardRoleCounts)}`);
  assert(spawnSummary.homeguardRoleCounts["defense-warship"] > 0, `Defense warships should be present in defensive fleets: ${JSON.stringify(spawnSummary.homeguardRoleCounts)}`);
  assert(spawnSummary.homeguardRaceSamples.nevari.maxHp > spawnSummary.homeguardRaceSamples.svarin.maxHp,
    `Nevari defenders should be tougher than Svarin defenders: ${JSON.stringify(spawnSummary.homeguardRaceSamples)}`);
  assert(spawnSummary.homeguardRaceSamples.aaruian.averageGuardRadius < spawnSummary.homeguardRaceSamples.svarin.averageGuardRadius,
    `Aaruian defenders should hold tighter guard space than Svarin defenders: ${JSON.stringify(spawnSummary.homeguardRaceSamples)}`);
  assert(spawnSummary.production.respawnCooldownsMs.zone["base-fighter"] < spawnSummary.production.respawnCooldownsMs.zone["support-fighter"],
    `Zone base fighters should respawn faster than support fighters: ${JSON.stringify(spawnSummary.production.respawnCooldownsMs)}`);
  assert(spawnSummary.production.respawnCooldownsMs.zone["support-fighter"] < spawnSummary.production.respawnCooldownsMs.zone["defense-warship"],
    `Zone support fighters should respawn faster than defense warships: ${JSON.stringify(spawnSummary.production.respawnCooldownsMs)}`);
  assert(spawnSummary.production.respawnCooldownsMs.zone["defense-warship"] < spawnSummary.production.respawnCooldownsMs.zone["attack-warship"],
    `Zone defense warships should respawn faster than attack warships: ${JSON.stringify(spawnSummary.production.respawnCooldownsMs)}`);
  assert(spawnSummary.production.respawnCooldownsMs.primeWorld["base-fighter"] < spawnSummary.production.respawnCooldownsMs.zone["base-fighter"],
    `Prime World production should be faster than zone production for base fighters: ${JSON.stringify(spawnSummary.production.respawnCooldownsMs)}`);
  assert(spawnSummary.production.respawnCooldownsMs.primeWorld["attack-warship"] < spawnSummary.production.respawnCooldownsMs.zone["attack-warship"],
    `Prime World production should be faster than zone production for attack warships: ${JSON.stringify(spawnSummary.production.respawnCooldownsMs)}`);

  const behaviorCheck = await page.evaluate((cellSize) => {
    const space = window.__loeGame?.scene.keys.space;
    const playerX = space.shipRoot.x;
    const playerY = space.shipRoot.y;

    [...space.shipStates.values()].forEach((state, index) => {
      state.x = playerX + 4200 + (index * 12);
      state.y = playerY + 4200;
      state.velocityX = 0;
      state.velocityY = 0;
      state.patrolX = state.x;
      state.patrolY = state.y;
      state.cellKey = `${Math.max(0, Math.floor(state.x / cellSize))},${Math.max(0, Math.floor(state.y / cellSize))}`;
    });

    const stageFaction = (factionId, x, y) => {
      const state = [...space.shipStates.values()].find((entry) => entry.factionId === factionId && !entry.destroyed);
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

    const pirateId = stageFaction("pirate", playerX + 320, playerY);
    const smugglerId = stageFaction("smuggler", playerX - 1800, playerY + 1400);
    const homeguardId = stageFaction("homeguard", playerX + 1800, playerY + 1400);
    space.syncActiveWorld?.(true);

    const pirate = space.factionShips.find((ship) => ship.id === pirateId);
    const smuggler = space.factionShips.find((ship) => ship.id === smugglerId);
    const homeguard = space.factionShips.find((ship) => ship.id === homeguardId);
    if (!pirate || !smuggler || !homeguard) {
      return null;
    }

    const pirateTarget = space.selectShipTarget(pirate)?.kind ?? null;
    const pirateThreatensPlayer = space.isShipHostileToPlayer?.(pirate) ?? false;
    smuggler.root.x = playerX - 320;
    smuggler.root.y = playerY;
    smuggler.velocity.set(0, 0);
    smuggler.patrolTarget.set(smuggler.root.x, smuggler.root.y);
    const smugglerBefore = space.selectShipTarget(smuggler)?.kind ?? null;
    homeguard.root.x = playerX;
    homeguard.root.y = playerY + 340;
    homeguard.velocity.set(0, 0);
    homeguard.patrolTarget.set(homeguard.root.x, homeguard.root.y);
    const homeguardBefore = space.selectShipTarget(homeguard)?.kind ?? null;
    const homeguardThreatensPlayer = space.isShipHostileToPlayer?.(homeguard) ?? false;
    const pirateVsSmuggler = space.isShipHostileToShip(pirate, smuggler);
    const homeguardVsPirate = space.isShipHostileToShip(homeguard, pirate);
    const homeguardStates = [...space.shipStates.values()].filter((state) => state.factionId === "homeguard" && state.originRaceId && !state.destroyed);
    const aggroTargetState = homeguardStates[0] ?? null;
    const sameRaceAllyState = aggroTargetState
      ? homeguardStates.find((state) => state.originRaceId === aggroTargetState.originRaceId && state.id !== aggroTargetState.id) ?? null
      : null;
    const differentRaceAllyState = aggroTargetState
      ? homeguardStates.find((state) => state.originRaceId !== aggroTargetState.originRaceId) ?? null
      : null;

    if (aggroTargetState && sameRaceAllyState && differentRaceAllyState) {
      const stagedHomeguards = [
        { state: aggroTargetState, x: playerX + 620, y: playerY - 40 },
        { state: sameRaceAllyState, x: playerX + 700, y: playerY + 10 },
        { state: differentRaceAllyState, x: playerX + 680, y: playerY - 110 },
      ];
      stagedHomeguards.forEach(({ state, x, y }) => {
        state.x = x;
        state.y = y;
        state.velocityX = 0;
        state.velocityY = 0;
        state.patrolX = x;
        state.patrolY = y;
        state.provokedByPlayer = false;
        state.provokedByShips = [];
        state.aggressionTimer = 0;
        state.cellKey = `${Math.max(0, Math.floor(x / cellSize))},${Math.max(0, Math.floor(y / cellSize))}`;
      });
      space.syncActiveWorld?.(true);
    }

    const aggroTarget = aggroTargetState ? space.factionShips.find((ship) => ship.id === aggroTargetState.id) ?? null : null;
    const sameRaceAlly = sameRaceAllyState ? space.factionShips.find((ship) => ship.id === sameRaceAllyState.id) ?? null : null;
    const differentRaceAlly = differentRaceAllyState ? space.factionShips.find((ship) => ship.id === differentRaceAllyState.id) ?? null : null;
    if (aggroTarget && sameRaceAlly && differentRaceAlly) {
      space.damageFactionShip(aggroTarget, 1, { kind: "player" });
    }

    const smugglerHullBefore = smuggler.hp;
    space.damageFactionShip(smuggler, 1, { kind: "player" }, smuggler.root.x);

    return {
      pirateTarget,
      pirateThreatensPlayer,
      smugglerBefore,
      homeguardBefore,
      homeguardThreatensPlayer,
      pirateVsSmuggler,
      homeguardVsPirate,
      aggroTargetRace: aggroTarget?.originRaceId ?? null,
      sameRaceAggro: sameRaceAlly?.provokedByPlayer ?? false,
      differentRaceAggro: differentRaceAlly?.provokedByPlayer ?? false,
      smugglerHullBefore,
      smugglerHullAfter: smuggler.hp,
      smugglerProvoked: smuggler.provokedByPlayer,
      smugglerAfter: space.selectShipTarget(smuggler)?.kind ?? null,
    };
  }, 3200);

  assert(behaviorCheck, "Could not stage pirate, smuggler, and homeguard ships for neutral baseline checks");
  assert(behaviorCheck.pirateThreatensPlayer, `Pirates should still threaten the player by default: ${JSON.stringify(behaviorCheck)}`);
  assert(behaviorCheck.smugglerBefore === null, "Smugglers should remain neutral before being attacked");
  assert(!behaviorCheck.homeguardThreatensPlayer && behaviorCheck.homeguardBefore !== "player",
    `Prime world guardians should not attack the player by default: ${JSON.stringify(behaviorCheck)}`);
  assert(behaviorCheck.pirateVsSmuggler, "Pirates should still threaten smugglers");
  assert(behaviorCheck.homeguardVsPirate, "Prime world guardians should still respond to pirate pressure");
  assert(behaviorCheck.sameRaceAggro && !behaviorCheck.differentRaceAggro,
    `Guardian aggro should stay inside the attacked race's defensive group: ${JSON.stringify(behaviorCheck)}`);
  assert(behaviorCheck.smugglerHullAfter <= behaviorCheck.smugglerHullBefore, "Smuggler damage application failed during provocation check");
  assert(behaviorCheck.smugglerProvoked && behaviorCheck.smugglerAfter === "player",
    `Smuggler should retaliate after being attacked: ${JSON.stringify(behaviorCheck)}`);

  const summary = {
    spawnSummary,
    behaviorCheck,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}
