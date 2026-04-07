import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/ui-vision");
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

async function getTextState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function capture(page, name) {
  const textState = await getTextState(page);
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: true,
  });
  return textState;
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
    window.__loeGame.scene.start("ui-vision");
  });
  await waitForScene(page, "ui-vision");
  await page.waitForTimeout(250);

  const summary = {};
  summary.mainMenu = await capture(page, "main-menu");

  await page.evaluate(() => {
    const uiVision = window.__loeGame.scene.keys["ui-vision"];
    uiVision.showPage("data-pad");
  });
  await page.waitForTimeout(150);
  summary.dataPad = await capture(page, "data-pad");

  await page.evaluate(() => {
    const uiVision = window.__loeGame.scene.keys["ui-vision"];
    uiVision.showPage("inventory");
  });
  await page.waitForTimeout(150);
  summary.inventory = await capture(page, "inventory");

  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
