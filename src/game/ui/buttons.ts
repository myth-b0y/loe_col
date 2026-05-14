import Phaser from "phaser";
import { retroSfx, type SfxCue } from "../audio/retroSfx";

export type MenuButton = {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  setEnabled: (enabled: boolean) => void;
  setInputEnabled: (enabled: boolean) => void;
  setLabel: (label: string) => void;
  setOnClick: (onClick: () => void) => void;
  setCooldownProgress: (progress: number) => void;
  setFocused: (focused: boolean) => void;
  trigger: () => void;
  isEnabled: () => boolean;
};

type ButtonOptions = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height?: number;
  label: string;
  onClick: () => void;
  onPress?: (pointer: Phaser.Input.Pointer) => void;
  onRelease?: (pointer: Phaser.Input.Pointer) => void;
  depth?: number;
  accentColor?: number;
  disabled?: boolean;
  clickCue?: SfxCue | false;
};

export function createMenuButton({
  scene,
  x,
  y,
  width,
  height = 48,
  label,
  onClick,
  onPress,
  onRelease,
  depth = 10,
  accentColor = 0x194777,
  disabled = false,
  clickCue = "ui-click",
}: ButtonOptions): MenuButton {
  const background = scene.add
    .rectangle(0, 0, width, height, accentColor, disabled ? 0.32 : 0.88)
    .setStrokeStyle(2, 0xaed0ff, disabled ? 0.35 : 0.75);
  background.setInteractive({ useHandCursor: true });
  background.setScrollFactor(0);

  const cooldownOverlay = scene.add.rectangle(0, -height / 2 + 3, width - 6, height - 6, 0x03070d, 0.42)
    .setOrigin(0.5, 0)
    .setVisible(false);
  cooldownOverlay.setScrollFactor(0);

  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial",
    fontSize: "18px",
    color: disabled ? "#a7b8cf" : "#f5fbff",
    fontStyle: "bold",
  });
  text.setOrigin(0.5);
  text.setScrollFactor(0);

  const button = scene.add.container(x, y, [background, cooldownOverlay, text]).setDepth(depth);
  button.setSize(width, height);

  let enabled = !disabled;
  let inputEnabled = true;
  let focused = false;
  let hovered = false;

  const applyVisualState = (): void => {
    const interactive = enabled && inputEnabled && button.visible;
    const highlighted = interactive && (hovered || focused);
    background.setAlpha(enabled ? 0.88 : 0.32);
    background.setScale(highlighted ? 1.02 : 1, highlighted ? 1.04 : 1);
    background.setFillStyle(highlighted ? 0x215a96 : accentColor, enabled ? (highlighted ? 0.96 : 0.88) : 0.32);
    background.setStrokeStyle(2, highlighted ? 0xe5f2ff : 0xaed0ff, enabled ? (highlighted ? 0.96 : 0.75) : 0.35);
    text.setColor(enabled ? "#f5fbff" : "#a7b8cf");
    if (background.input) {
      background.input.enabled = interactive;
    }
  };

  const refresh = (): void => {
    applyVisualState();
  };

  refresh();

  background.on("pointerover", () => {
    if (!enabled) {
      return;
    }

    hovered = true;
    applyVisualState();
  });

  background.on("pointerout", () => {
    hovered = false;
    applyVisualState();
  });

  let clickHandler = onClick;
  let pressHandler = onPress;
  let releaseHandler = onRelease;
  let cooldownProgress = 0;
  let currentLabel = label;
  let lastEnabled = enabled;
  let lastInputEnabled = inputEnabled;

  const runClickHandler = (): void => {
    if (!enabled || !inputEnabled || !button.visible) {
      return;
    }

    if (clickCue) {
      retroSfx.play(clickCue, { volume: 0.4 });
    }
    clickHandler();
  };

  background.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }

    pressHandler?.(pointer);
    runClickHandler();
  });

  background.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }

    releaseHandler?.(pointer);
  });

  background.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }

    releaseHandler?.(pointer);
  });

  return {
    container: button,
    label: text,
    setEnabled(nextEnabled: boolean) {
      if (lastEnabled === nextEnabled) {
        return;
      }

      enabled = nextEnabled;
      lastEnabled = nextEnabled;
      refresh();
    },
    setInputEnabled(nextEnabled: boolean) {
      if (lastInputEnabled === nextEnabled) {
        return;
      }

      inputEnabled = nextEnabled;
      lastInputEnabled = nextEnabled;
      refresh();
    },
    setLabel(nextLabel: string) {
      if (currentLabel === nextLabel) {
        return;
      }

      currentLabel = nextLabel;
      text.setText(nextLabel);
    },
    setOnClick(nextHandler: () => void) {
      clickHandler = nextHandler;
    },
    setCooldownProgress(progress: number) {
      const nextProgress = Phaser.Math.Clamp(progress, 0, 1);
      if (Math.abs(nextProgress - cooldownProgress) < 0.01) {
        return;
      }

      cooldownProgress = nextProgress;
      if (cooldownProgress <= 0) {
        cooldownOverlay.setVisible(false);
        return;
      }

      cooldownOverlay.setVisible(true);
      cooldownOverlay.setDisplaySize(width - 6, Math.max(3, (height - 6) * cooldownProgress));
    },
    setFocused(nextFocused: boolean) {
      if (focused === nextFocused) {
        return;
      }

      focused = nextFocused;
      applyVisualState();
    },
    trigger() {
      runClickHandler();
    },
    isEnabled() {
      return enabled && inputEnabled && button.visible;
    },
  };
}
