import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-loot-rank-hud-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
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

async function waitForScene(page, sceneKey, timeoutMs = 10000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? "{}"));
    if (state.activeScene === sceneKey) {
      return state;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for scene '${sceneKey}'`);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await ensureDir(OUTPUT_DIR);
  await page.goto(URL, { waitUntil: "networkidle" });
  await waitForGameBootstrap(page);

  const summary = await page.evaluate(() => {
    window.localStorage.clear();
    const session = window.__loeSession;
    session.startNewGame(0);
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.start("space");
    return true;
  });
  assert(summary === true, "Failed to seed fresh space scene");
  await waitForScene(page, "space");
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const session = window.__loeSession;
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return null;
    }

    space.refreshHud?.();
    const hudBefore = {
      route: space.routeText?.text ?? "",
      status: space.statusText?.text ?? "",
      contact: space.contactText?.text ?? "",
      ship: space.coordinateText?.text ?? "",
      buttons: [
        space.logbookButton?.labelText?.text ?? "",
        space.pauseButton?.labelText?.text ?? "",
        space.returnButton?.labelText?.text ?? "",
      ],
    };

    const randomBefore = Math.random;
    Math.random = () => 0;
    const asteroid = space.asteroids.find((entry) => entry.kind === "asteroid") ?? null;
    if (!asteroid) {
      return { error: "No asteroid available for loot test" };
    }
    asteroid.isLarge = true;
    space.spawnAsteroidLootDrops?.({ kind: "asteroid", resourceType: "iron-ore", isLarge: true }, asteroid.root.x, asteroid.root.y);
    space.spawnAsteroidLootDrops?.({ kind: "asteroid", resourceType: "aetherium-ore", isLarge: true }, asteroid.root.x + 40, asteroid.root.y + 20);
    space.spawnAsteroidLootDrops?.({ kind: "asteroid", resourceType: "starforged-alloy", isLarge: true }, asteroid.root.x - 40, asteroid.root.y - 20);
    const oreNames = space.spacePickups
      .map((pickup) => pickup.item?.name ?? (pickup.kind === "credits" ? "credits" : "unknown"))
      .filter(Boolean);

    const officerState = space.createMissionShipState?.({
      id: `verify-empire-officer-${Math.round(performance.now())}`,
      factionId: "empire",
      role: "elite-target",
      kind: "hostile",
      x: space.shipRoot.x + 180,
      y: space.shipRoot.y + 80,
      targetX: space.shipRoot.x,
      targetY: space.shipRoot.y,
      radius: 20,
      hp: 6,
      originRaceId: space.warState.empireRaceId,
    });
    if (!officerState) {
      Math.random = randomBefore;
      return { error: "Failed to create Empire officer state" };
    }
    officerState.rankLevel = 4;
    officerState.rankXp = 0;
    officerState.kills = 0;
    space.shipStates.set(officerState.id, officerState);
    const empireShip = space.createFactionShip?.(officerState);
    if (!empireShip) {
      Math.random = randomBefore;
      return { error: "Failed to create active Empire officer ship" };
    }
    space.factionShips.push(empireShip);
    const rankBadgeActivePips = empireShip.rankBadgePips?.filter?.((pip) => (pip?.fillAlpha ?? 0) > 0.5)?.length ?? 0;
    const xpBefore = session.saveData.profile.xp;
    const creditsBefore = session.getCredits();
    space.damageFactionShip?.(empireShip, 999, { kind: "player" });
    const dropNames = space.spacePickups
      .map((pickup) => pickup.item?.name ?? (pickup.kind === "credits" ? `Credits x${pickup.amount ?? 0}` : "unknown"))
      .filter(Boolean);

    for (const pickup of [...space.spacePickups]) {
      space.shipRoot.x = pickup.baseX;
      space.shipRoot.y = pickup.baseY;
      space.updateSpacePickups?.(1 / 60);
    }

    const intelStateAfterPickup = session.getSecretIntelRunState?.() ?? null;
    space.refreshHud?.();
    const hudAfterPickup = {
      route: space.routeText?.text ?? "",
      contact: space.contactText?.text ?? "",
    };

    const targetPlanet = intelStateAfterPickup?.targetPlanetId
      ? space.galaxyPlanetsById.get(intelStateAfterPickup.targetPlanetId) ?? null
      : null;
    if (targetPlanet) {
      const position = space.getSecretIntelWaypoint?.();
      if (position) {
        space.shipRoot.x = position.x;
        space.shipRoot.y = position.y;
      }
      space.tryOpenNearestPrimeWorldComms?.();
      space.handleStationMissionAction?.();
    }
    Math.random = randomBefore;

    return {
      hudBefore,
      hudAfterPickup,
      oreNames,
      dropNames,
      rankBadgeActivePips,
      xpBefore,
      xpAfter: session.saveData.profile.xp,
      creditsBefore,
      creditsAfter: session.getCredits(),
      intelStateAfterPickup,
      intelStateAfterDelivery: session.getSecretIntelRunState?.() ?? null,
      cargoNames: session.getCargoItems?.()?.map?.((item) => item?.name ?? null) ?? [],
      rankBoostCharges: space.forceState?.rankBoostChargesByRace ?? {},
    };
  });

  assert(result && !result.error, `Verifier setup failed: ${JSON.stringify(result)}`);
  assert(!result.hudBefore.contact.includes("Auto Aim") && !result.hudBefore.contact.includes("Auto Fire"),
    `HUD should not show debug aim/fire clutter: ${JSON.stringify(result.hudBefore)}`);
  assert(!result.hudBefore.contact.includes("Contacts  Empire") && !result.hudBefore.contact.includes("WASD move"),
    `HUD should not show nearby ship type lists or controls: ${JSON.stringify(result.hudBefore)}`);
  assert(result.hudBefore.ship.includes("HULL") && result.hudBefore.ship.includes("SHIELD") && result.hudBefore.ship.includes("REACTOR"),
    `Right HUD should remain ship-status focused: ${JSON.stringify(result.hudBefore)}`);
  assert(result.oreNames.includes("Iron Ore") && result.oreNames.includes("Aetherium Ore") && result.oreNames.includes("Starforged Alloy"),
    `Asteroid loot should follow typed ore-tier drops: ${JSON.stringify(result.oreNames)}`);
  assert(result.rankBadgeActivePips === 4, `Officer ship should expose a readable 4-pip rank badge: ${JSON.stringify(result.rankBadgeActivePips)}`);
  assert(result.dropNames.some((name) => name.startsWith("Credits x")),
    `Ship kills should drop credits: ${JSON.stringify(result.dropNames)}`);
  assert(result.dropNames.includes("Scrap Ship Parts"),
    `Ship kills should be able to drop scrap ship parts: ${JSON.stringify(result.dropNames)}`);
  assert(result.dropNames.includes("Secret Intel"),
    `Officer Empire kills should be able to drop Secret Intel: ${JSON.stringify(result.dropNames)}`);
  assert(result.xpAfter > result.xpBefore, `Space ship kills should grant player XP: ${JSON.stringify({ xpBefore: result.xpBefore, xpAfter: result.xpAfter })}`);
  assert(result.creditsAfter > result.creditsBefore, `Collected space credits should increase player credits: ${JSON.stringify({ creditsBefore: result.creditsBefore, creditsAfter: result.creditsAfter })}`);
  assert(result.intelStateAfterPickup?.active === true, `Picking up Secret Intel should start the delivery run: ${JSON.stringify(result.intelStateAfterPickup)}`);
  assert(result.hudAfterPickup.route.includes("Secret Intel Delivery"),
    `Secret Intel run should take over the active course HUD: ${JSON.stringify(result.hudAfterPickup)}`);
  assert(result.intelStateAfterDelivery?.active === false,
    `Delivering Secret Intel at the Republic Prime World should complete the run: ${JSON.stringify(result.intelStateAfterDelivery)}`);

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
