import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/cleanup-pass");
fs.mkdirSync(outputDir, { recursive: true });

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(
    (expectedScene) => {
      if (typeof window.render_game_to_text !== "function") {
        return false;
      }
      try {
        const payload = JSON.parse(window.render_game_to_text());
        return payload?.activeScene === expectedScene;
      } catch {
        return false;
      }
    },
    sceneKey,
    { timeout: 10000 },
  );
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://127.0.0.1:4173/?renderer=canvas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await waitForScene(page, "main-menu");

  await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeGame.scene.start("hub");
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(300);

  const emptyLogbook = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.toggleLogbookOverlay();
    return {
      acceptedMissionIds: window.__loeSession.getAcceptedMissionIds(),
      selectedMissionId: window.__loeSession.getSelectedMissionId(),
      emptyText: hub.logbookOverlay?.emptyQueueText?.text ?? null,
      emptyVisible: hub.logbookOverlay?.emptyQueueText?.visible ?? false,
      completedToggle: hub.logbookOverlay?.completedToggleText?.text ?? null,
      visibleCards: hub.logbookOverlay?.cards
        ?.filter((card) => card.frame.visible)
        ?.map((card) => card.contractId) ?? [],
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "logbook-empty.png"),
    fullPage: true,
  });

  const queuedMissionState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    window.__loeSession.acceptMission("ember-watch");
    hub.refreshMissionState();
    hub.logbookOverlay?.refresh?.();
    return {
      acceptedMissionIds: window.__loeSession.getAcceptedMissionIds(),
      selectedMissionId: window.__loeSession.getSelectedMissionId(),
      visibleCards: hub.logbookOverlay?.cards
        ?.filter((card) => card.frame.visible)
        ?.map((card) => ({
          id: card.contractId,
          text: card.status.text,
        })) ?? [],
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "logbook-queued.png"),
    fullPage: true,
  });

  const companionRoster = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    return {
      crew: hub.crew?.map((companion) => ({
        id: companion.id,
        roleLabel: companion.roleLabel,
      })) ?? [],
      roleCounts: window.__loeGame.scene.keys.hub.deployRosterCards
        ?.map((card) => card.companion.role)
        ?.reduce((counts, role) => {
          counts[role] = (counts[role] ?? 0) + 1;
          return counts;
        }, {}) ?? {},
    };
  });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        emptyLogbook,
        queuedMissionState,
        companionRoster,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
