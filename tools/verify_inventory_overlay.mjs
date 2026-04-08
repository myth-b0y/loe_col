import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/inventory-overlay");
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
  await page.waitForTimeout(250);

  const beforeState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openStation("loadout");
    return {
      inventoryVisible: hub.inventoryOverlay?.isVisible?.() ?? false,
      equipment: window.__loeSession.getEquipmentLoadout(),
      cargo: window.__loeSession.getCargoSlots(),
    };
  });

  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDir, "inventory-layout.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    const session = window.__loeSession;
    session.saveData.loadout.equipment.head = null;
    session.saveData.loadout.cargo[0] = "survey-hood";
    const hub = window.__loeGame.scene.keys.hub;
    hub.inventoryOverlay?.refresh?.();
  });

  await page.waitForTimeout(100);
  const canvas = await page.locator("canvas").boundingBox();
  const clickGamePoint = async (gameX, gameY) => {
    const targetX = canvas.x + (gameX / 1280) * canvas.width;
    const targetY = canvas.y + (gameY / 720) * canvas.height;
    await page.mouse.click(targetX, targetY);
  };

  await clickGamePoint(170, 560);
  await page.waitForTimeout(120);
  await clickGamePoint(176, 238);
  await page.waitForTimeout(120);

  const afterState = await page.evaluate(() => ({
    equipment: window.__loeSession.getEquipmentLoadout(),
    cargo: window.__loeSession.getCargoSlots(),
  }));

  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify({ beforeState, afterState }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
