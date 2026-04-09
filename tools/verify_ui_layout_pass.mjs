import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/ui-layout-pass");
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
  await page.goto("http://127.0.0.1:5173/?renderer=canvas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await waitForScene(page, "main-menu");

  await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeGame.scene.start("hub");
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(300);

  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) {
    throw new Error("Canvas not found");
  }

  await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openStation("loadout");
  });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDir, "inventory.png"),
    fullPage: true,
  });

  await page.keyboard.press("F7");
  await page.waitForTimeout(150);
  await page.screenshot({
    path: path.join(outputDir, "inventory-debug.png"),
    fullPage: true,
  });
  await page.keyboard.press("F7");
  await page.waitForTimeout(120);

  await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openDataPadTab?.("missions");
  });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDir, "missions-empty.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    window.__loeSession.acceptMission("ember-watch");
    window.__loeSession.setSelectedMission("ember-watch");
    const hub = window.__loeGame.scene.keys.hub;
    hub.logbookOverlay?.refresh?.();
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(outputDir, "missions-routed.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openDataPadTab?.("inventory");
  });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDir, "inventory-return.png"),
    fullPage: true,
  });

  const summary = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    return {
      inventoryVisible: hub.inventoryOverlay?.isVisible?.() ?? false,
      logbookVisible: hub.logbookOverlay?.isVisible?.() ?? false,
      selectedMissionId: window.__loeSession.getSelectedMissionId(),
      acceptedMissionIds: window.__loeSession.getAcceptedMissionIds(),
    };
  });

  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
