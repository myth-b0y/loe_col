import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-station-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";
const REPAIR_BUTTON = { x: 678, y: 546 };
const LEAVE_BUTTON = { x: 948, y: 546 };

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
    window.__loeSession?.acceptMission?.("ember-watch");
    window.__loeSession?.setSelectedMission?.("ember-watch");
    window.__loeGame?.scene.start("hub");
  });

  await waitForScene(page, "hub");
  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.("ember-watch");
  });

  await waitForScene(page, "space");
  await page.waitForTimeout(260);
  await capture(page, "space-start.png");

  const stationTargets = await page.evaluate(() => {
    const galaxy = window.__loeSession?.getGalaxyDefinition?.() ?? null;
    const war = window.__loeSession?.getFactionWarState?.() ?? null;
    const getControllerRaceId = (station) => {
      const nearestZone = (galaxy?.zones ?? [])
        .filter((zone) => zone.sectorId === station.sectorId)
        .map((zone) => {
          const system = (galaxy?.systems ?? []).find((candidate) => candidate.id === zone.systemId);
          if (!system) {
            return null;
          }
          const dx = system.x - station.x;
          const dy = system.y - station.y;
          return {
            zone,
            distanceSq: (dx * dx) + (dy * dy),
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.distanceSq - right.distanceSq)[0]?.zone ?? null;
      return nearestZone?.currentControllerId ?? null;
    };
    const getAlignment = (controllerRaceId) => {
      if (!war || !controllerRaceId) {
        return "neutral";
      }
      if (war.empireRaceId === controllerRaceId) {
        return "empire";
      }
      if (Array.isArray(war.republicRaceIds) && war.republicRaceIds.includes(controllerRaceId)) {
        return "republic";
      }
      return "neutral";
    };
    const stations = (galaxy?.stations ?? []).map((station) => ({
      id: station.id,
      name: station.name,
      x: station.x,
      y: station.y,
      radius: station.radius,
      sectorId: station.sectorId,
      alignment: getAlignment(getControllerRaceId(station)),
    }));
    return {
      usable: stations.find((station) => station.alignment !== "empire") ?? stations[0] ?? null,
      restricted: stations.find((station) => station.alignment === "empire") ?? null,
    };
  });

  const stationTarget = stationTargets?.usable ?? null;
  assert(stationTarget, "Could not resolve a generated usable station for verification");

  await page.evaluate((station) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space || !station) {
      return;
    }

    const playerX = Math.round(station.x - (station.radius + 100));
    const playerY = Math.round(station.y);
    space.shipRoot.x = playerX;
    space.shipRoot.y = playerY;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(playerX, playerY);
    window.__loeSession?.setShipSystemIntegrity?.("hull", 54);
    window.__loeSession?.setShipSystemIntegrity?.("engines", 72);
    window.__loeSession?.setShipSystemOnline?.("navigation", false);
    space.syncActiveWorld?.(true);
    space.refreshHud?.();
  }, stationTarget);
  await page.waitForTimeout(2200);
  await capture(page, "station-in-range.png");

  const stationRangeState = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const snapshot = space?.getDebugSnapshot?.() ?? null;
    return {
      snapshot,
      radarContacts: snapshot?.radar?.contacts ?? [],
      credits: window.__loeSession?.getCredits?.() ?? null,
      repairCost: window.__loeSession?.getShipRepairCost?.() ?? null,
      shipSystems: window.__loeSession?.getShipSystemsState?.() ?? null,
    };
  });

  assert(stationRangeState.snapshot?.nearestStation?.inRange === true,
    `Station should be in interaction range: ${JSON.stringify(stationRangeState.snapshot?.nearestStation)}`);
  assert((stationRangeState.snapshot?.activeStations ?? 0) > 0,
    `Space scene did not activate any station views: ${JSON.stringify(stationRangeState.snapshot)}`);
  assert(stationRangeState.radarContacts.some((contact) => contact.kind === "station"),
    `Radar did not report a station contact: ${JSON.stringify(stationRangeState.radarContacts)}`);
  assert(stationRangeState.repairCost > 0, `Repair cost should be positive after damaging the ship: ${stationRangeState.repairCost}`);

  const keybindState = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      desktopControls: space?.desktopControlsText?.text ?? "",
      interactKeyCode: space?.inputKeys?.interact?.keyCode ?? null,
    };
  });
  assert(keybindState.interactKeyCode === 70,
    `Space interaction key should be F: ${JSON.stringify(keybindState)}`);
  assert(keybindState.desktopControls.includes("F interact / land"),
    `Desktop controls text did not update to the F interaction hint: ${keybindState.desktopControls}`);

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.tryHandlePrimaryInteraction?.();
    space?.refreshHud?.();
  });
  await page.waitForTimeout(180);
  await capture(page, "station-overlay-open.png");

  const overlayOpenState = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const overlay = space?.stationOverlay;
    return {
      snapshot: space?.getDebugSnapshot?.() ?? null,
      visible: overlay?.isVisible?.() ?? false,
      summaryText: overlay?.summaryText?.text ?? "",
      statusText: overlay?.statusText?.text ?? "",
      repairLabel: overlay?.repairButton?.label?.text ?? "",
      leaveLabel: overlay?.leaveButton?.label?.text ?? "",
      buyLabel: overlay?.buyButton?.label?.text ?? "",
      sellLabel: overlay?.sellButton?.label?.text ?? "",
    };
  });

  assert(overlayOpenState.visible === true, "Station comms overlay did not open with F");
  assert(overlayOpenState.snapshot?.stationOverlayVisible === true,
    `Space debug snapshot did not report the station overlay as visible: ${JSON.stringify(overlayOpenState.snapshot)}`);
  assert(overlayOpenState.summaryText.includes("Repair bay quote"),
    `Station overlay is missing the repair summary: ${overlayOpenState.summaryText}`);
  assert(overlayOpenState.repairLabel.includes("Repair"),
    `Station overlay is missing the Repair option: ${overlayOpenState.repairLabel}`);
  assert(overlayOpenState.leaveLabel.includes("Leave") || overlayOpenState.leaveLabel.includes("Depart"),
    `Station overlay is missing the Leave/Depart option: ${overlayOpenState.leaveLabel}`);
  assert(overlayOpenState.buyLabel === "Buy" && overlayOpenState.sellLabel === "Sell",
    `Station overlay is missing Buy/Sell placeholders: ${JSON.stringify(overlayOpenState)}`);

  await page.mouse.click(REPAIR_BUTTON.x, REPAIR_BUTTON.y);
  await page.waitForTimeout(180);
  await capture(page, "station-overlay-repaired.png");

  const repairedState = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const overlay = space?.stationOverlay;
    return {
      credits: window.__loeSession?.getCredits?.() ?? null,
      repairCost: window.__loeSession?.getShipRepairCost?.() ?? null,
      shipSystems: window.__loeSession?.getShipSystemsState?.() ?? null,
      statusText: overlay?.statusText?.text ?? "",
      summaryText: overlay?.summaryText?.text ?? "",
    };
  });

  assert(repairedState.credits === stationRangeState.credits - stationRangeState.repairCost,
    `Repair did not deduct the expected credits: before=${stationRangeState.credits} after=${repairedState.credits} cost=${stationRangeState.repairCost}`);
  assert(repairedState.repairCost === 0, `Repair should clear the repair quote after a successful repair: ${repairedState.repairCost}`);
  Object.values(repairedState.shipSystems ?? {}).forEach((system) => {
    assert(system.integrity === 100 && system.online === true,
      `Repair did not restore all ship systems: ${JSON.stringify(repairedState.shipSystems)}`);
  });
  assert(repairedState.statusText.includes("Repair complete"),
    `Station overlay did not report a successful repair: ${repairedState.statusText}`);

  await page.mouse.click(LEAVE_BUTTON.x, LEAVE_BUTTON.y);
  await page.waitForTimeout(160);

  const overlayClosedState = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      snapshot: space?.getDebugSnapshot?.() ?? null,
      visible: space?.stationOverlay?.isVisible?.() ?? false,
    };
  });

  assert(overlayClosedState.visible === false, "Station overlay did not close after pressing Leave/Depart");
  assert(overlayClosedState.snapshot?.stationOverlayVisible === false,
    `Space debug snapshot still thinks the station overlay is visible: ${JSON.stringify(overlayClosedState.snapshot)}`);

  if (stationTargets?.restricted) {
    await page.evaluate((station) => {
      const space = window.__loeGame?.scene.keys.space;
      if (!space || !station) {
        return;
      }

      const playerX = Math.round(station.x - (station.radius + 100));
      const playerY = Math.round(station.y);
      space.shipRoot.x = playerX;
      space.shipRoot.y = playerY;
      space.shipVelocity.set(0, 0);
      window.__loeSession?.setShipSpacePosition?.(playerX, playerY);
      space.syncActiveWorld?.(true);
      space.refreshHud?.();
    }, stationTargets.restricted);
    await page.waitForTimeout(240);

    const restrictedBefore = await page.evaluate(() => {
      const space = window.__loeGame?.scene.keys.space;
      return {
        nearestStation: space?.getDebugSnapshot?.()?.nearestStation ?? null,
        overlayVisible: space?.stationOverlay?.isVisible?.() ?? false,
      };
    });
    assert(restrictedBefore.nearestStation?.inRange === true,
      `Restricted Empire station should still be physically in range: ${JSON.stringify(restrictedBefore)}`);

    await page.evaluate(() => {
      const space = window.__loeGame?.scene.keys.space;
      space?.tryHandlePrimaryInteraction?.();
      space?.refreshHud?.();
    });
    await page.waitForTimeout(140);

    const restrictedAfter = await page.evaluate(() => {
      const space = window.__loeGame?.scene.keys.space;
      return {
        overlayVisible: space?.stationOverlay?.isVisible?.() ?? false,
        statusLines: space?.statusMessages?.map?.((message) => message.text) ?? [],
      };
    });
    assert(restrictedAfter.overlayVisible === false,
      `Empire station should not open station comms for the player: ${JSON.stringify(restrictedAfter)}`);
    assert(restrictedAfter.statusLines.some((line) => line.includes("denied access") || line.includes("denied")),
      `Empire station denial should be surfaced to the player: ${JSON.stringify(restrictedAfter)}`);
  }

  const smugglerRouteState = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const smugglerSeed = space?.worldDefinition?.factionSeeds?.find?.((seed) => seed.factionId === "smuggler") ?? null;
    if (!space || !smugglerSeed) {
      return null;
    }

    const playerX = Math.round(smugglerSeed.x - 900);
    const playerY = Math.round(smugglerSeed.y);
    space.shipRoot.x = playerX;
    space.shipRoot.y = playerY;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(playerX, playerY);
    space.syncActiveWorld?.(true);

    const smuggler = space.factionShips.find((ship) => ship.factionId === "smuggler") ?? null;
    if (!smuggler) {
      return {
        activeSmuggler: false,
      };
    }

    space.assignSmugglerRouteTarget?.(smuggler, "world");
    const firstKind = smuggler.routeTargetKind;
    const firstTargetId = smuggler.routeTargetId;
    const firstTarget = space.resolveSmugglerRouteTarget?.(smuggler.routeTargetKind, smuggler.routeTargetId) ?? null;
    if (!firstTarget) {
      return {
        activeSmuggler: true,
        firstKind,
        firstTargetId,
        firstTargetResolved: false,
      };
    }

    smuggler.root.x = firstTarget.x;
    smuggler.root.y = firstTarget.y;
    smuggler.velocity.set(0, 0);
    space.getSmugglerRouteMovement?.(smuggler, 0.016);
    const firstWait = smuggler.routeWaitRemainingMs;
    smuggler.routeWaitRemainingMs = 0;
    space.assignSmugglerRouteTarget?.(smuggler, space.getNextSmugglerLegKind?.(smuggler) ?? "station");
    const stationKind = smuggler.routeTargetKind;
    const stationTarget = space.resolveSmugglerRouteTarget?.(smuggler.routeTargetKind, smuggler.routeTargetId) ?? null;
    if (!stationTarget) {
      return {
        activeSmuggler: true,
        firstKind,
        firstTargetId,
        firstWait,
        stationKind,
        stationTargetResolved: false,
      };
    }

    smuggler.root.x = stationTarget.x;
    smuggler.root.y = stationTarget.y;
    smuggler.velocity.set(0, 0);
    space.getSmugglerRouteMovement?.(smuggler, 0.016);
    const secondWait = smuggler.routeWaitRemainingMs;
    smuggler.routeWaitRemainingMs = 0;
    space.assignSmugglerRouteTarget?.(smuggler, space.getNextSmugglerLegKind?.(smuggler) ?? "world");
    const finalKind = smuggler.routeTargetKind;
    const finalTargetId = smuggler.routeTargetId;
    space.refreshHud?.();

    return {
      activeSmuggler: true,
      firstKind,
      firstTargetId,
      firstWait,
      stationKind,
      secondWait,
      finalKind,
      finalTargetId,
      snapshot: space.getDebugSnapshot?.() ?? null,
    };
  });

  assert(smugglerRouteState?.activeSmuggler === true,
    `Could not activate a smuggler ship for route verification: ${JSON.stringify(smugglerRouteState)}`);
  assert(smugglerRouteState.firstKind === "planet" || smugglerRouteState.firstKind === "moon",
    `Smuggler route did not start with a planet/moon target: ${JSON.stringify(smugglerRouteState)}`);
  assert(smugglerRouteState.firstWait > 0,
    `Smuggler did not enter a wait state after reaching the world target: ${JSON.stringify(smugglerRouteState)}`);
  assert(smugglerRouteState.stationKind === "station",
    `Smuggler did not route from world to station: ${JSON.stringify(smugglerRouteState)}`);
  assert(smugglerRouteState.secondWait > 0,
    `Smuggler did not enter a wait state after reaching the station: ${JSON.stringify(smugglerRouteState)}`);
  assert(smugglerRouteState.finalKind === "planet" || smugglerRouteState.finalKind === "moon",
    `Smuggler did not loop back to a world target after station service: ${JSON.stringify(smugglerRouteState)}`);
  assert((smugglerRouteState.snapshot?.smugglerRoutes ?? []).some((route) => route.routeTargetKind),
    `Space debug snapshot did not expose a routed smuggler: ${JSON.stringify(smugglerRouteState.snapshot)}`);

  await capture(page, "smuggler-route-pass.png");

  const result = {
    stationTarget,
    stationRangeState,
    overlayOpenState,
    repairedState,
    overlayClosedState,
    smugglerRouteState,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
