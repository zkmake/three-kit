# Mockup page

The dev-only page that renders any area's variant in the app's own look: a `@zkmake/three-studio` page. Loaded by step 3 when the app has no `mockups.html` yet, and when adding an area.

## Files

| File                                 | Holds                                                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mockups.html` (beside `index.html`) | A copy of the app's `index.html` (or `studio.html`) whose script is `/src/mockups.tsx`, titled `Mockups \| <App>`. Vite builds `index.html` alone, so the page never ships. |
| `src/mockups.tsx`                    | The page: the config (every area's variants and views), the stage (ground, lights, fog), `<Studio>`.                                                                        |
| `src/mockups/<area>.tsx`             | One area: its variants, exported as `<AREA>_VARIANTS`.                                                                                                                      |
| `src/scene/<part>-kit.ts`            | Builders shared by the mockups and, once picked, the scene.                                                                                                                 |

## The page

```tsx
import { orbitViews } from "@zkmake/three-studio";
import { Studio } from "@zkmake/three-studio/react";

<Studio
  config={{
    views: orbitViews(centre, near, { play: { offset, fov } }),
    areas: { signs: { title: "Signs", variants: SIGNS_VARIANTS } },
  }}
  canvas={(state) => ({
    ...APP_CANVAS,
    scene: OUTDOOR.has(state.areaName) ? { fog: appFog() } : {},
  })}
  stage={(state) => <Stage ground={state.variant.ground} />}
/>;
```

- **Canvas** set up exactly as the app's: its tone mapping, `dpr`, camera lens, fog (outdoor areas), lights (import the app's lights component). Shots need no `preserveDrawingBuffer`.
- **Views**: `play` copies the app camera's pose for that area (a chase camera behind a vehicle, the menu camera for a showroom); `close` and `wide` frame detail and layout. An area's views add to the page's; a camera variant brings its own.
- **URL**: three-studio's: `?area=<area>&v=<variant>&view=<view>`, chips for each along the top, `&t=<s>` to freeze animation, `&clean=1` for captures without the chips.
- **Ground**: a `ground` key per variant, read by the stage: `flat` (the app's ground and road), `road` (for variants that bring their own terrain), `none` (indoors).
- **Readout and helpers** come with `<Studio>`: the draw-call readout, three-audit's console helpers, the variant's group tagged `<area>-<variant>` so `summary("signs-rich")` and `zfight()` look at it alone.

## A variant

```tsx
import type { StudioReactVariant } from "@zkmake/three-studio/react";

type MockupVariant = StudioReactVariant & { ground: "flat" | "road" | "none" };

export const SIGNS_VARIANTS = {
  now: { label: "Now: …", render: () => <NowSigns />, ground: "flat" },
  rich: { label: "…", render: () => <RichSigns />, ground: "flat" },
} satisfies Record<string, MockupVariant>;
```

- Build geometry once (`useMemo` or module scope), merged per object with colour per vertex on one material, instanced when it repeats.
- Extras over an existing model (a livery, a detail kit) are a separate merged layer drawn beside the real model, so the variant needs no fork of the model file.
- Things placed on a surface read its height from one function (`groundAt(x, z)`) through a React context, so the same variant stands on flat ground or on hills.
- Animation reads time through `useStudioTime()`, so `&t=` freezes it.
- Name every geometry (`geometry.name`) so `census()` and the meter report it.
