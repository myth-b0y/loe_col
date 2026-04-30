import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/mission-activity-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";

const TERMINAL_MISSION_IDS = [
  "test-travel-survey",
  "test-comms-checkin",
  "test-space-battle",
  "test-ground-sweep",
  "test-zone-reclaim",
  "test-kill-target",
  "test-boss-climax",
  "test-chain-dispatch",
];

const LIVE_MISSION_IDS = [
  "test-escort-distress",
  "test-resource-salvage",
];

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

async function waitForScene(page, sceneKey, timeoutMs = 10000) {
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

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
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

  const contractState = await page.evaluate(({ terminalIds, liveIds }) => {
    const contracts = window.__loeContracts ?? [];
    return {
      count: contracts.length,
      terminalIds: contracts.filter((contract) => contract.terminalVisible).map((contract) => contract.id),
      liveIds: contracts.filter((contract) => contract.source?.kind === "live-space").map((contract) => contract.id),
      activityTypes: contracts.map((contract) => contract.activityType),
      activityCounts: contracts.map((contract) => [contract.id, contract.activities?.length ?? 0]),
      terminalPresent: terminalIds.every((id) => contracts.some((contract) => contract.id === id && contract.terminalVisible)),
      livePresent: liveIds.every((id) => contracts.some((contract) => contract.id === id && contract.source?.kind === "live-space")),
    };
  }, { terminalIds: TERMINAL_MISSION_IDS, liveIds: LIVE_MISSION_IDS });

  assert(contractState.count === 10, `Expected 10 temporary test missions, got ${contractState.count}`);
  assert(contractState.terminalPresent, `Terminal test missions are missing: ${JSON.stringify(contractState.terminalIds)}`);
  assert(contractState.livePresent, `Live-space test missions are missing: ${JSON.stringify(contractState.liveIds)}`);
  assert(contractState.terminalIds.length === TERMINAL_MISSION_IDS.length,
    `Expected exactly ${TERMINAL_MISSION_IDS.length} terminal missions: ${JSON.stringify(contractState.terminalIds)}`);
  assert(new Set(contractState.activityTypes).size >= 9,
    `Expected broad activity type coverage: ${JSON.stringify(contractState.activityTypes)}`);
  contractState.activityCounts.forEach(([id, count]) => {
    assert(count > 0, `Mission '${id}' has no activity steps`);
  });

  await page.evaluate(() => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    window.__loeSession?.acceptMission?.("test-travel-survey");
    window.__loeSession?.setSelectedMission?.(null);
    window.__loeGame?.scene.start("hub");
  });
  await waitForScene(page, "hub");
  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.(null);
  });
  await waitForScene(page, "space");
  await page.waitForTimeout(350);
  await capture(page, "accepted-not-course.png");

  const acceptedNotActive = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      selectedMissionId: window.__loeSession?.getSelectedMissionId?.() ?? null,
      acceptedMissionIds: window.__loeSession?.getAcceptedMissionIds?.() ?? [],
      snapshot: space?.getDebugSnapshot?.() ?? null,
    };
  });
  assert(acceptedNotActive.acceptedMissionIds.includes("test-travel-survey"),
    `Travel test mission was not accepted: ${JSON.stringify(acceptedNotActive)}`);
  assert(acceptedNotActive.selectedMissionId === null,
    `Mission should not be set as course yet: ${JSON.stringify(acceptedNotActive)}`);
  assert(acceptedNotActive.snapshot?.activeMissionWaypoint === null,
    `Accepted but inactive mission should not show a waypoint: ${JSON.stringify(acceptedNotActive.snapshot?.activeMissionWaypoint)}`);

  await page.evaluate(() => {
    window.__loeSession?.setSelectedMission?.("test-travel-survey");
  });
  await page.waitForTimeout(450);
  await capture(page, "travel-course-set.png");

  const travelActive = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      selectedMissionId: window.__loeSession?.getSelectedMissionId?.() ?? null,
      snapshot: space?.getDebugSnapshot?.() ?? null,
    };
  });
  assert(travelActive.selectedMissionId === "test-travel-survey",
    `Travel test mission was not set as course: ${JSON.stringify(travelActive)}`);
  assert(travelActive.snapshot?.activeMissionWaypoint?.missionId === "test-travel-survey",
    `Set-course travel mission did not expose an active waypoint: ${JSON.stringify(travelActive.snapshot?.activeMissionWaypoint)}`);

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const waypoint = space?.getDebugSnapshot?.()?.activeMissionWaypoint;
    if (!space || !waypoint) {
      return;
    }
    space.shipRoot.x = waypoint.x;
    space.shipRoot.y = waypoint.y;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(waypoint.x, waypoint.y);
    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();
  });
  await page.waitForTimeout(450);
  await capture(page, "travel-complete.png");

  const travelCompleted = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      completedMissionIds: window.__loeSession?.getCompletedMissionIds?.() ?? [],
      acceptedMissionIds: window.__loeSession?.getAcceptedMissionIds?.() ?? [],
      selectedMissionId: window.__loeSession?.getSelectedMissionId?.() ?? null,
      credits: window.__loeSession?.getCredits?.() ?? null,
      snapshot: space?.getDebugSnapshot?.() ?? null,
    };
  });
  assert(travelCompleted.completedMissionIds.includes("test-travel-survey"),
    `Travel mission did not complete after reaching waypoint: ${JSON.stringify(travelCompleted)}`);
  assert(!travelCompleted.acceptedMissionIds.includes("test-travel-survey"),
    `Completed mission should leave the accepted queue: ${JSON.stringify(travelCompleted.acceptedMissionIds)}`);
  assert(travelCompleted.selectedMissionId === null,
    `Completed mission should clear active course: ${JSON.stringify(travelCompleted)}`);
  assert(travelCompleted.snapshot?.activeMissionWaypoint === null,
    `Completed mission should clear waypoint: ${JSON.stringify(travelCompleted.snapshot?.activeMissionWaypoint)}`);

  await page.waitForTimeout(2600);
  const liveGranted = await page.evaluate((liveIds) => ({
    acceptedMissionIds: window.__loeSession?.getAcceptedMissionIds?.() ?? [],
    selectedMissionId: window.__loeSession?.getSelectedMissionId?.() ?? null,
    granted: liveIds.map((id) => [id, window.__loeSession?.isLiveMissionGranted?.(id) ?? false]),
    snapshot: window.__loeGame?.scene.keys.space?.getDebugSnapshot?.() ?? null,
  }), LIVE_MISSION_IDS);
  assert(liveGranted.granted.every(([, granted]) => granted),
    `Live-space missions were not granted in flight: ${JSON.stringify(liveGranted.granted)}`);
  assert(LIVE_MISSION_IDS.every((id) => liveGranted.acceptedMissionIds.includes(id)),
    `Live-space missions should enter accepted state: ${JSON.stringify(liveGranted.acceptedMissionIds)}`);
  assert(liveGranted.selectedMissionId === null,
    `Live-space grant should not automatically set course: ${JSON.stringify(liveGranted)}`);
  assert(liveGranted.snapshot?.activeMissionWaypoint === null,
    `Live-space grants should not show waypoints until set course: ${JSON.stringify(liveGranted.snapshot?.activeMissionWaypoint)}`);

  await page.evaluate(() => {
    window.__loeSession?.setSelectedMission?.("test-escort-distress");
  });
  await page.waitForTimeout(450);
  await capture(page, "escort-course-set.png");

  const escortActive = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      selectedMissionId: window.__loeSession?.getSelectedMissionId?.() ?? null,
      snapshot: space?.getDebugSnapshot?.() ?? null,
    };
  });
  assert(escortActive.selectedMissionId === "test-escort-distress",
    `Escort distress mission was not set as course: ${JSON.stringify(escortActive)}`);
  assert(escortActive.snapshot?.activeMissionWaypoint?.missionId === "test-escort-distress",
    `Escort mission did not expose a waypoint after set course: ${JSON.stringify(escortActive.snapshot?.activeMissionWaypoint)}`);
  assert(escortActive.snapshot?.activeMissionWaypoint?.kind === "ship",
    `Escort waypoint should track the escorted ship: ${JSON.stringify(escortActive.snapshot?.activeMissionWaypoint)}`);
  assert((escortActive.snapshot?.missionObjects ?? []).some((object) => object.kind === "escort"),
    `Escort mission did not spawn an escort object: ${JSON.stringify(escortActive.snapshot?.missionObjects)}`);

  const zoneState = await page.evaluate(() => {
    window.__loeSession?.acceptMission?.("test-zone-reclaim");
    window.__loeSession?.setSelectedMission?.("test-zone-reclaim");
    const space = window.__loeGame?.scene.keys.space;
    space?.updateMissionActivity?.(1 / 60);
    const before = space?.getDebugSnapshot?.() ?? null;
    const waypoint = before?.activeMissionWaypoint;
    if (waypoint) {
      space.shipRoot.x = waypoint.x;
      space.shipRoot.y = waypoint.y;
      space.shipVelocity.set(0, 0);
      window.__loeSession?.setShipSpacePosition?.(waypoint.x, waypoint.y);
      space.tryCompleteInteractiveMissionStep?.();
      space.updateMissionActivity?.(1 / 60);
      space.refreshHud?.();
    }
    return {
      before,
      after: space?.getDebugSnapshot?.() ?? null,
      completedMissionIds: window.__loeSession?.getCompletedMissionIds?.() ?? [],
    };
  });
  assert(zoneState.before?.activeMissionWaypoint?.kind === "zone",
    `Zone mission did not target a zone waypoint: ${JSON.stringify(zoneState.before?.activeMissionWaypoint)}`);
  assert(zoneState.before?.war?.contestedZones?.length > 0,
    `Zone mission did not create visible contested state: ${JSON.stringify(zoneState.before?.war)}`);
  assert(zoneState.completedMissionIds.includes("test-zone-reclaim"),
    `Zone support mission did not complete: ${JSON.stringify(zoneState.completedMissionIds)}`);
  assert(zoneState.after?.war?.contestedZones?.length === 0,
    `Zone support mission should stabilize contested state: ${JSON.stringify(zoneState.after?.war)}`);

  const result = {
    contractState,
    acceptedNotActive,
    travelActive,
    travelCompleted,
    liveGranted,
    escortActive,
    zoneState,
    consoleErrors,
  };
  await fs.writeFile(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
