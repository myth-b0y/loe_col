import Phaser from "phaser";

export type ShadowSource = {
  x: number;
  y: number;
  radius: number;
  intensity?: number;
  active?: boolean;
};

export type LightingRigOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  ambientAlpha?: number;
  darkColor?: number;
  veilDepth?: number;
  shadowDepth?: number;
  lightDepth?: number;
};

export type LightingRig = {
  supported: boolean;
  veil: Phaser.GameObjects.Rectangle;
  shadowGraphics: Phaser.GameObjects.Graphics;
  setRegion: (x: number, y: number, width: number, height: number) => void;
  createPointLight: (
    x: number,
    y: number,
    color: number,
    radius: number,
    intensity?: number,
    attenuation?: number,
  ) => Phaser.GameObjects.PointLight | Phaser.GameObjects.Arc;
  refreshShadows: (
    sources: ShadowSource[],
    casters: Phaser.Geom.Rectangle[],
    maxShadowLength?: number,
  ) => void;
  destroy: () => void;
};

type AnyLight = Phaser.GameObjects.PointLight | Phaser.GameObjects.Arc;

export function createLightingRig(scene: Phaser.Scene, options: LightingRigOptions): LightingRig {
  const supported = scene.game.renderer.type === Phaser.WEBGL;
  if (supported) {
    scene.lights.enable();
  }

  const veil = scene.add.rectangle(
    options.x + options.width / 2,
    options.y + options.height / 2,
    options.width,
    options.height,
    options.darkColor ?? 0x01050c,
    options.ambientAlpha ?? 0.42,
  )
    .setDepth(options.veilDepth ?? 10)
    .setScrollFactor(1);

  const shadowGraphics = scene.add.graphics()
    .setDepth(options.shadowDepth ?? 10.4)
    .setScrollFactor(1);
  shadowGraphics.setBlendMode(Phaser.BlendModes.MULTIPLY);

  const setRegion = (x: number, y: number, width: number, height: number): void => {
    veil.setPosition(x + width / 2, y + height / 2);
    veil.setSize(width, height);
  };

  const createPointLight = (
    x: number,
    y: number,
    color: number,
    radius: number,
    intensity = 1,
    attenuation = 0.075,
  ): AnyLight => {
    if (!supported) {
      return scene.add.circle(x, y, radius * 0.18, color, 0.26)
        .setDepth(options.lightDepth ?? 10.8)
        .setBlendMode(Phaser.BlendModes.ADD);
    }

    const light = scene.add.pointlight(x, y, color, radius, intensity, attenuation)
      .setDepth(options.lightDepth ?? 10.8);
    light.alpha = 0.14;
    light.attenuation = Math.max(0.14, attenuation * 2.2);
    return light;
  };

  const refreshShadows = (
    sources: ShadowSource[],
    casters: Phaser.Geom.Rectangle[],
    maxShadowLength = 360,
  ): void => {
    shadowGraphics.clear();

    sources.forEach((source) => {
      if (source.active === false || source.radius <= 0 || source.intensity === 0) {
        return;
      }

      casters.forEach((caster) => {
        const shadow = buildShadowPolygon(source, caster, maxShadowLength);
        if (!shadow) {
          return;
        }

        const distance = Phaser.Math.Distance.Between(source.x, source.y, caster.centerX, caster.centerY);
        if (distance >= source.radius * 1.35) {
          return;
        }

        const falloff = 1 - Phaser.Math.Clamp(distance / (source.radius * 1.35), 0, 1);
        const alpha = Phaser.Math.Clamp((source.intensity ?? 1) * 0.32 * falloff, 0.08, 0.34);
        shadowGraphics.fillStyle(0x000000, alpha);
        shadowGraphics.fillPoints(shadow, true);
      });
    });
  };

  return {
    supported,
    veil,
    shadowGraphics,
    setRegion,
    createPointLight,
    refreshShadows,
    destroy: () => {
      shadowGraphics.destroy();
      veil.destroy();
    },
  };
}

export function setAnyLightPosition(light: AnyLight | null | undefined, x: number, y: number): void {
  if (!light) {
    return;
  }

  light.setPosition(x, y);
}

export function setAnyLightVisible(light: AnyLight | null | undefined, visible: boolean): void {
  if (!light) {
    return;
  }

  light.setVisible(visible);
}

export function setAnyLightColor(light: AnyLight | null | undefined, color: number): void {
  if (!light) {
    return;
  }

  if (light instanceof Phaser.GameObjects.PointLight) {
    const rgb = Phaser.Display.Color.IntegerToRGB(color);
    light.color.setTo(rgb.r, rgb.g, rgb.b);
    return;
  }

  light.setFillStyle(color, light.fillAlpha);
  if ("setStrokeStyle" in light) {
    (light as Phaser.GameObjects.Arc).setStrokeStyle(2, color, 0.65);
  }
}

export function setAnyLightRadius(light: AnyLight | null | undefined, radius: number): void {
  if (!light) {
    return;
  }

  if (light instanceof Phaser.GameObjects.PointLight) {
    light.radius = radius;
    return;
  }

  light.setRadius(Math.max(6, radius * 0.18));
}

export function setAnyLightIntensity(light: AnyLight | null | undefined, intensity: number): void {
  if (!light) {
    return;
  }

  if (light instanceof Phaser.GameObjects.PointLight) {
    light.intensity = intensity;
    light.alpha = Phaser.Math.Clamp(0.08 + intensity * 0.05, 0.08, 0.24);
    return;
  }

  light.setAlpha(Phaser.Math.Clamp(0.06 + intensity * 0.08, 0.06, 0.28));
}

function buildShadowPolygon(
  source: ShadowSource,
  rect: Phaser.Geom.Rectangle,
  maxShadowLength: number,
): Phaser.Geom.Point[] | null {
  const corners = [
    new Phaser.Geom.Point(rect.left, rect.top),
    new Phaser.Geom.Point(rect.right, rect.top),
    new Phaser.Geom.Point(rect.right, rect.bottom),
    new Phaser.Geom.Point(rect.left, rect.bottom),
  ];

  const cornerAngles = corners
    .map((corner) => ({
      corner,
      angle: Phaser.Math.Angle.Wrap(Math.atan2(corner.y - source.y, corner.x - source.x)),
    }))
    .sort((a, b) => a.angle - b.angle);

  let largestGap = Number.NEGATIVE_INFINITY;
  let gapIndex = 0;
  for (let index = 0; index < cornerAngles.length; index += 1) {
    const current = cornerAngles[index];
    const next = cornerAngles[(index + 1) % cornerAngles.length];
    const wrappedNextAngle = index === cornerAngles.length - 1 ? next.angle + Math.PI * 2 : next.angle;
    const gap = wrappedNextAngle - current.angle;
    if (gap > largestGap) {
      largestGap = gap;
      gapIndex = index;
    }
  }

  const cornerA = cornerAngles[(gapIndex + 1) % cornerAngles.length].corner;
  const cornerB = cornerAngles[gapIndex].corner;
  const extensionA = projectPointAwayFromSource(source, cornerA, maxShadowLength);
  const extensionB = projectPointAwayFromSource(source, cornerB, maxShadowLength);

  if (!extensionA || !extensionB) {
    return null;
  }

  return [cornerA, cornerB, extensionB, extensionA];
}

function projectPointAwayFromSource(
  source: ShadowSource,
  point: Phaser.Geom.Point,
  maxShadowLength: number,
): Phaser.Geom.Point | null {
  const direction = new Phaser.Math.Vector2(point.x - source.x, point.y - source.y);
  if (direction.lengthSq() <= 0.0001) {
    return null;
  }

  direction.normalize();
  const projectedLength = Math.min(maxShadowLength, source.radius * 1.18);
  return new Phaser.Geom.Point(
    point.x + direction.x * projectedLength,
    point.y + direction.y * projectedLength,
  );
}
