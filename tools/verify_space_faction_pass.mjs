import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-faction-pass");
const URL = "http://127.0.0.1:4173/?renderer=canvas";

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
    hub.player.setPosition(640, 176);
    hub.updateNearestStation?.();
    hub.updateInteractionTarget?.();
    hub.updatePrompt?.();
  });
  await page.keyboard.press("e");
  await page.waitForTimeout(250);

  const pilotPanel = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    return {
      title: hub?.panelTitle?.text ?? "",
      actionLabel: hub?.panelAction?.label?.text ?? "",
    };
  });
  assert(pilotPanel.title === "Pilot Seat", `Unexpected pilot seat title '${pilotPanel.title}'`);
  assert(pilotPanel.actionLabel === "Launch Into Space", `Unexpected launch label '${pilotPanel.actionLabel}'`);

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.(null);
  });

  const spaceState = await waitForScene(page, "space");
  await page.waitForTimeout(300);
  await capture(page, "space-start.png");

  const spawnSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const ships = [...space.worldDefinition.factionSeeds];
    const sectorCounts = ships.reduce((acc, ship) => {
      if (!acc[ship.sectorId]) {
        acc[ship.sectorId] = { empire: 0, pirate: 0, republic: 0, smuggler: 0 };
      }
      acc[ship.sectorId][ship.factionId] += 1;
      return acc;
    }, {});
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
    return {
      factionCounts: space.getDebugSnapshot().factionCounts,
      sectorCounts,
      shipCount: ships.length,
      groupSizes: Object.values(groupSizes),
    };
  });

  assert(spawnSummary.factionCounts.empire > 0, "Empire ships did not spawn");
  assert(spawnSummary.factionCounts.pirate > 0, "Pirate ships did not spawn");
  assert(spawnSummary.factionCounts.republic > 0, "Republic ships did not spawn");
  assert(spawnSummary.factionCounts.smuggler > 0, "Smuggler ships did not spawn");
  assert(spawnSummary.shipCount >= 140, `Faction ship population is lower than expected: ${spawnSummary.shipCount}`);
  assert(Object.keys(spawnSummary.sectorCounts).length >= 4, "Sector-based ship spawning is too sparse");
  assert(spawnSummary.groupSizes.every((group) => group.leaders === 1), "Every faction patrol group should have exactly one leader");
  assert(spawnSummary.groupSizes.filter((group) => group.factionId === "empire").every((group) => group.size >= 3),
    `Empire groups should patrol in army formations: ${JSON.stringify(spawnSummary.groupSizes.filter((group) => group.factionId === "empire"))}`);
  assert(spawnSummary.groupSizes.filter((group) => group.factionId === "republic").every((group) => group.size >= 3),
    `Republic groups should patrol in army formations: ${JSON.stringify(spawnSummary.groupSizes.filter((group) => group.factionId === "republic"))}`);
  assert(spawnSummary.groupSizes.filter((group) => group.factionId === "pirate").every((group) => group.size >= 2 && group.size <= 3),
    `Pirate groups should patrol in 2-3 ship packs: ${JSON.stringify(spawnSummary.groupSizes.filter((group) => group.factionId === "pirate"))}`);
  assert(spawnSummary.groupSizes.filter((group) => group.factionId === "smuggler").every((group) => group.size === 1),
    `Smugglers should patrol alone: ${JSON.stringify(spawnSummary.groupSizes.filter((group) => group.factionId === "smuggler"))}`);

  const behaviorCheck = await page.evaluate((cellSize) => {
    const space = window.__loeGame?.scene.keys.space;
    const playerX = space.shipRoot.x;
    const playerY = space.shipRoot.y;
    const placements = {
      empire: { x: playerX + 340, y: playerY },
      republic: { x: playerX + 520, y: playerY },
      pirate: { x: playerX - 340, y: playerY },
      smuggler: { x: playerX, y: playerY + 320 },
    };
    const stageFaction = (factionId) => {
      const state = [...space.shipStates.values()].find((entry) => entry.factionId === factionId && !entry.destroyed);
      const placement = placements[factionId];
      state.x = placement.x;
      state.y = placement.y;
      state.velocityX = 0;
      state.velocityY = 0;
      state.patrolX = placement.x;
      state.patrolY = placement.y;
      state.aimX = 0;
      state.aimY = -1;
      state.provokedByPlayer = false;
      state.provokedByShips = [];
      state.aggressionTimer = 0;
      state.cellKey = `${Math.max(0, Math.floor(state.x / cellSize))},${Math.max(0, Math.floor(state.y / cellSize))}`;
      const activeShip = space.factionShips.find((ship) => ship.id === state.id);
      if (activeShip) {
        activeShip.root.x = placement.x;
        activeShip.root.y = placement.y;
        activeShip.velocity.set(0, 0);
        activeShip.patrolTarget.set(placement.x, placement.y);
        activeShip.aimDirection.set(0, -1);
        activeShip.provokedByPlayer = false;
        activeShip.provokedByShips.clear();
        activeShip.aggressionTimer = 0;
      }
      return state.id;
    };

    const empireId = stageFaction("empire");
    const republicId = stageFaction("republic");
    const pirateId = stageFaction("pirate");
    const smugglerId = stageFaction("smuggler");
    space.syncActiveWorld?.(true);

    const empire = space.factionShips.find((ship) => ship.id === empireId);
    const republic = space.factionShips.find((ship) => ship.id === republicId);
    const pirate = space.factionShips.find((ship) => ship.id === pirateId);
    const smuggler = space.factionShips.find((ship) => ship.id === smugglerId);

    const parkFar = (ship, xOffset, yOffset) => {
      ship.root.x = playerX + xOffset;
      ship.root.y = playerY + yOffset;
      ship.velocity.set(0, 0);
    };

    parkFar(empire, 2200, 0);
    parkFar(republic, 2600, 0);
    parkFar(pirate, -2200, 0);
    parkFar(smuggler, 0, 2200);

    empire.root.x = playerX + 340;
    empire.root.y = playerY;
    const empireTarget = space.selectShipTarget(empire)?.kind ?? null;

    parkFar(empire, 2200, 0);
    republic.root.x = playerX + 340;
    republic.root.y = playerY;
    const republicTarget = space.selectShipTarget(republic)?.kind ?? null;
    const republicHullBefore = republic.hp;
    space.damageFactionShip(republic, 1, { kind: "player" }, republic.root.x);
    const republicHullAfter = republic.hp;
    const republicProvoked = republic.provokedByPlayer;

    parkFar(republic, 2600, 0);
    pirate.root.x = playerX - 340;
    pirate.root.y = playerY;
    const pirateTarget = space.selectShipTarget(pirate)?.kind ?? null;

    parkFar(pirate, -2200, 0);
    smuggler.root.x = playerX;
    smuggler.root.y = playerY + 320;
    smuggler.provokedByPlayer = false;
    smuggler.provokedByShips.clear();
    smuggler.aggressionTimer = 0;
    const smugglerBefore = space.selectShipTarget(smuggler)?.kind ?? null;

    space.damageFactionShip(smuggler, 1, { kind: "player" }, smuggler.root.x);
    const smugglerAfter = space.selectShipTarget(smuggler)?.kind ?? null;

    parkFar(pirate, -2200, 0);
    empire.root.x = playerX + 620;
    empire.root.y = playerY;
    empire.velocity.set(0, 0);
    empire.patrolTarget.set(empire.root.x, empire.root.y);
    empire.provokedByPlayer = false;
    empire.provokedByShips.clear();

    republic.root.x = playerX + 260;
    republic.root.y = playerY;
    republic.velocity.set(0, 0);
    republic.patrolTarget.set(republic.root.x, republic.root.y);
    republic.provokedByPlayer = false;
    republic.provokedByShips.clear();

    const empirePrefersShip = space.selectShipTarget(empire)?.kind ?? null;
    const republicPrefersShip = space.selectShipTarget(republic)?.kind ?? null;

    empire.root.x = playerX - 260;
    empire.root.y = playerY;
    empire.velocity.set(0, 0);
    empire.patrolTarget.set(empire.root.x, empire.root.y);

    pirate.root.x = playerX - 620;
    pirate.root.y = playerY;
    pirate.velocity.set(0, 0);
    pirate.patrolTarget.set(pirate.root.x, pirate.root.y);
    const piratePrefersShip = space.selectShipTarget(pirate)?.kind ?? null;

    return {
      empireTarget,
      republicTarget,
      republicHullBefore,
      republicHullAfter,
      republicProvoked,
      pirateTarget,
      smugglerBefore,
      smugglerAfter,
      smugglerProvoked: smuggler.provokedByPlayer,
      empireVsRepublic: space.isShipHostileToShip(empire, republic),
      republicVsEmpire: space.isShipHostileToShip(republic, empire),
      pirateVsSmuggler: space.isShipHostileToShip(pirate, smuggler),
      empirePrefersShip,
      republicPrefersShip,
      piratePrefersShip,
    };
  }, 3200);

  assert(behaviorCheck.empireTarget === "player", "Empire should treat the player as hostile");
  assert(behaviorCheck.republicTarget !== "player", "Republic should not attack the player by default");
  assert(behaviorCheck.republicHullAfter === behaviorCheck.republicHullBefore, "Republic ships should not take player damage");
  assert(!behaviorCheck.republicProvoked, "Republic ships should not become provoked by player attacks");
  assert(behaviorCheck.pirateTarget === "player", "Pirates should treat the player as hostile");
  assert(behaviorCheck.empireVsRepublic, "Empire should be hostile to Republic ships");
  assert(behaviorCheck.republicVsEmpire, "Republic should be hostile to Empire ships");
  assert(behaviorCheck.pirateVsSmuggler, "Pirates should be hostile to smugglers");
  assert(behaviorCheck.empirePrefersShip === "ship", "Empire should prefer hostile ships over the player when they are available");
  assert(behaviorCheck.republicPrefersShip === "ship", "Republic should prefer hostile ships over the player when they are available");
  assert(behaviorCheck.piratePrefersShip === "ship", "Pirates should prefer hostile ships over the player when they are available");
  assert(behaviorCheck.smugglerBefore === null, "Smugglers should be neutral before being attacked");
  assert(behaviorCheck.smugglerProvoked && behaviorCheck.smugglerAfter === "player", "Smuggler did not retaliate after being attacked");

  const combatCheck = await page.evaluate(async (cellSize) => {
    const space = window.__loeGame?.scene.keys.space;
    const playerX = space.shipRoot.x;
    const playerY = space.shipRoot.y;
    const stageFaction = (factionId, x, y) => {
      const state = [...space.shipStates.values()].find((entry) => entry.factionId === factionId && !entry.destroyed);
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
    const empireId = stageFaction("empire", playerX + 1200, playerY);
    const republicId = stageFaction("republic", playerX + 1480, playerY);
    space.syncActiveWorld?.(true);
    const empire = space.factionShips.find((ship) => ship.id === empireId);
    const republic = space.factionShips.find((ship) => ship.id === republicId);
    empire.root.x = playerX + 1200;
    empire.root.y = playerY;
    empire.velocity.set(0, 0);
    republic.root.x = playerX + 1480;
    republic.root.y = playerY;
    republic.velocity.set(0, 0);
    const empireHullBefore = empire.hp;
    const republicHullBefore = republic.hp;
    await new Promise((resolve) => setTimeout(resolve, 2200));
    return {
      empireHullBefore,
      republicHullAfter: republic.hp,
      empireHullAfter: empire.hp,
      factionShotCount: space.shots.filter((shot) => shot.ownerKind === "faction").length,
      destroyedFactionShips: space.getDebugSnapshot().destroyedFactionShips,
    };
  }, 3200);

  assert(
    combatCheck.factionShotCount > 0
      || combatCheck.empireHullAfter < combatCheck.empireHullBefore
      || combatCheck.republicHullAfter < combatCheck.empireHullBefore
      || combatCheck.destroyedFactionShips > 0,
    "Faction ships did not engage in readable combat",
  );

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space.damagePlayerShip(99, "pirate");
  });
  const gameOverState = await waitForScene(page, "game-over");
  await capture(page, "space-game-over.png");
  assert(gameOverState.snapshot.mode === "space", "Space death did not route into the normal game-over scene");

  await page.mouse.click(640, 294);
  await waitForScene(page, "space");
  await page.waitForTimeout(250);
  await capture(page, "space-continue.png");

  await page.mouse.click(1170, 44);
  await waitForScene(page, "hub");

  const summary = {
    spawnSummary,
    behaviorCheck,
    combatCheck,
    gameOver: gameOverState.snapshot,
    consoleErrors,
    initialSpaceSnapshot: spaceState.snapshot,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}



