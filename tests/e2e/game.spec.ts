import { expect, test, type Page } from '@playwright/test';

type HookState = {
  phase: string; paused: boolean; pauseReasons: string[]; round: number; endingIndex: number;
  upgrades: Record<string, number>; stats: Record<string, number>;
  player: { x: number; y: number; hp: number; mode: string; attack: string | null } | null;
  bossStage: string | null; boss: { hp: number; phase: number; state: string } | null; enemies: number; outcome: string | null;
  lockedBounds: { minX: number; maxX: number } | null;
};

const state = (page: Page) => page.evaluate(() => window.__GGC__!.state() as unknown as HookState);
const hook = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window.__GGC__ as unknown as Record<string, (...x: unknown[]) => unknown>)[f as string](...(a as unknown[])), [fn, args] as const);

async function boot(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('title')).toBeVisible({ timeout: 30_000 });
  // Keys held while a screen appears are consumed by design; give the title a moment to settle.
  await page.waitForTimeout(300);
  return errors;
}

/** 시작하기, then skips the control guide with Esc (menu cancel) so round 1 runs. */
async function startGame(page: Page) {
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hud')).toBeVisible();
  await expect.poll(async () => (await state(page)).phase).toBe('playing');
  await expect(page.getByTestId('tutorial')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tutorial')).toBeHidden();
  await expect.poll(async () => (await state(page)).paused).toBe(false);
}

async function waitPhase(page: Page, phase: string, timeout = 20_000) {
  await expect.poll(async () => (await state(page)).phase, { timeout }).toBe(phase);
}

/** Defeats the boss through damage hooks, verifying the phase-2 transition on the way. */
async function defeatBoss(page: Page) {
  await expect.poll(async () => (await state(page)).bossStage, { timeout: 10_000 }).toBe('fight');
  const s = await state(page);
  await hook(page, 'damageBoss', Math.ceil(s.boss!.hp / 2) + 1);
  await expect.poll(async () => (await state(page)).boss?.phase, { timeout: 10_000 }).toBe(2);
  await hook(page, 'setPlayerHp', 100);
  await hook(page, 'damageBoss', 99999);
  await expect.poll(async () => (await state(page)).outcome).toBe('victory');
}

test('T001/T002/T004 boot shows the real hero atlas, one canvas, no previews/review requests', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  const errors = await boot(page);
  expect(await page.evaluate(() => window.__GGC__!.atlasFrameCount())).toBeGreaterThanOrEqual(72);
  expect(await page.evaluate(() => window.__GGC__!.playerSpriteFrame())).toMatch(/^ganggamchan:ganggamchan_idle_0[1-4]$/);
  expect(await page.evaluate(() => window.__GGC__!.canvasCount())).toBe(1);
  expect(requested.some((u) => u.includes('ganggamchan_atlas.png'))).toBe(true);
  expect(requested.some((u) => /\/(previews|review)\//.test(u))).toBe(false);
  expect(errors).toEqual([]);
});

test('T098/T097 integer scaling and small-viewport notice', async ({ page }) => {
  for (const [w, h, sc] of [[1280, 720, 2], [1366, 768, 2], [1920, 1080, 3]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await expect(page.getByTestId('title')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('stage')).toHaveAttribute('data-scale', String(sc));
    const box = await page.getByTestId('stage').boundingBox();
    expect(box!.width).toBe(640 * sc);
    expect(box!.height).toBe(360 * sc);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await startGame(page);
  await page.setViewportSize({ width: 600, height: 340 });
  await expect(page.getByTestId('too-small')).toBeVisible();
  await expect.poll(async () => (await state(page)).pauseReasons).toContain('viewport-small');
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByTestId('too-small')).toBeHidden();
  const s = await state(page);
  expect(s.paused).toBe(true); // still waits for an explicit continue
});

test('T014/T017/T020 keyboard: start without jump, move, attack, pause/resume', async ({ page }) => {
  await boot(page);
  await startGame(page);
  let s = await state(page);
  expect(s.player!.y).toBe(304); // Enter that started the game did not become a jump
  const x0 = s.player!.x;
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  s = await state(page);
  expect(s.player!.x).toBeGreaterThan(x0 + 20);
  await page.keyboard.press('KeyJ');
  await expect.poll(async () => (await state(page)).player!.attack).toBe('weak1');
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause')).toBeVisible();
  const simT = await page.evaluate(() => (window.__GGC__!.state() as { simT: number }).simT);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window.__GGC__!.state() as { simT: number }).simT)).toBe(simT);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause')).toBeHidden();
  await expect.poll(async () => (await state(page)).paused).toBe(false);
});

test('T092/T094 tab hidden pauses and requires an explicit continue', async ({ page }) => {
  await boot(page);
  await startGame(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await state(page)).pauseReasons).toContain('hidden');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const s = await state(page);
  expect(s.pauseReasons).toEqual(['manual']);
  await expect(page.getByTestId('pause')).toBeVisible();
  await page.getByTestId('resume').click();
  await expect.poll(async () => (await state(page)).paused).toBe(false);
});

test('T003 atlas failure shows the file and retry recovers without reloading the page', async ({ page }) => {
  // Fail every atlas request until the user presses retry (StrictMode may create the game twice in dev).
  let allow = false;
  await page.route('**/ganggamchan_atlas.png', async (route) => {
    if (allow) await route.continue();
    else await route.abort();
  });
  await page.goto('/');
  await expect(page.getByTestId('load-error')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('load-error')).toContainText('ganggamchan_atlas.png');
  allow = true;
  await page.getByTestId('retry-load').click();
  await expect(page.getByTestId('title')).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => window.__GGC__!.atlasFrameCount())).toBeGreaterThanOrEqual(72);
  expect(await page.evaluate(() => window.__GGC__!.canvasCount())).toBe(1);
});

test('T089 death → game over → retry keeps stats and restarts the round', async ({ page }) => {
  await boot(page);
  await startGame(page);
  await hook(page, 'setPlayerHp', 0);
  await waitPhase(page, 'game-over');
  await expect(page.getByTestId('game-over')).toBeVisible();
  expect((await state(page)).stats.deaths).toBe(1);
  await page.keyboard.press('Enter');
  await waitPhase(page, 'playing');
  const s = await state(page);
  expect(s.round).toBe(1);
  expect(s.player!.hp).toBe(100);
  expect(s.stats.deaths).toBe(1);
});

test('T061/T103/T104 full run: 3 rounds, real waves in round 1, 2 rewards, ending, results', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await boot(page);
  await startGame(page);

  // Round 1: the arena runs its real 3 waves (enemies removed via test hook, timing by the game).
  await hook(page, 'teleport', 1205);
  await expect.poll(async () => (await state(page)).lockedBounds).toEqual({ minX: 960, maxX: 1600 });
  for (let w = 0; w < 3; w++) {
    await expect.poll(async () => (await state(page)).enemies, { timeout: 10_000 }).toBeGreaterThan(0);
    await hook(page, 'killWave');
    await expect.poll(async () => (await state(page)).enemies, { timeout: 10_000 }).toBe(0);
  }
  await expect.poll(async () => (await state(page)).lockedBounds, { timeout: 10_000 }).toBeNull();
  expect((await state(page)).stats.normalEnemyKills).toBe(9);
  await hook(page, 'toBoss');
  await defeatBoss(page);
  await waitPhase(page, 'reward');
  await expect(page.getByTestId('rewards')).toBeVisible();
  await page.keyboard.press('Enter'); // sword
  await waitPhase(page, 'playing');
  expect((await state(page)).round).toBe(2);
  expect((await state(page)).upgrades.sword).toBe(1);

  await hook(page, 'toBoss');
  await defeatBoss(page);
  await waitPhase(page, 'reward');
  await page.getByTestId('reward-parry').click();
  await waitPhase(page, 'playing');
  expect((await state(page)).round).toBe(3);

  await hook(page, 'toBoss');
  await defeatBoss(page);
  await waitPhase(page, 'ending');
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId(`ending-${i}`)).toBeVisible();
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
  }
  await waitPhase(page, 'results');
  await expect(page.getByTestId('stat-bosses')).toHaveText('3');
  await expect(page.getByTestId('stat-kills')).toHaveText('9');
  await expect(page.getByTestId('stat-deaths')).toHaveText('0');
  const s = await state(page);
  expect(s.upgrades).toEqual({ sword: 1, parry: 1, command_cooldown: 0 });
  await page.keyboard.press('Enter');
  await waitPhase(page, 'title');
  expect(errors).toEqual([]);
});

test('control guide after 시작하기: held round, spotlight steps, skip button top-right', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Enter');
  const guide = page.getByTestId('tutorial');
  await expect(guide).toBeVisible();
  await expect.poll(async () => (await state(page)).pauseReasons).toEqual(['tutorial']);
  const simT = await page.evaluate(() => (window.__GGC__!.state() as { simT: number }).simT);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window.__GGC__!.state() as { simT: number }).simT)).toBe(simT);
  // step 1 has no spotlight; Enter / → go forward, ← goes back
  await expect(page.getByTestId('tutorial-hole')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(guide).toHaveAttribute('data-step', '1');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(guide).toHaveAttribute('data-step', '1');
  // the hero spotlight is around the player; then the HP spotlight wraps the HP bar
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(guide).toHaveAttribute('data-step', '3');
  await page.waitForTimeout(300); // spotlight slides into place
  const hole = (await page.getByTestId('tutorial-hole').boundingBox())!;
  const hp = (await page.getByTestId('hud-hp').boundingBox())!;
  expect(hole.x).toBeLessThanOrEqual(hp.x);
  expect(hole.y).toBeLessThanOrEqual(hp.y);
  expect(hole.x + hole.width).toBeGreaterThanOrEqual(hp.x + hp.width);
  expect(hole.y + hole.height).toBeGreaterThanOrEqual(hp.y + hp.height);
  // 건너뛰기 sits in the top-right corner of the stage and resumes the round
  const skip = (await page.getByTestId('tutorial-skip').boundingBox())!;
  const stage = (await page.getByTestId('stage').boundingBox())!;
  expect(stage.x + stage.width - (skip.x + skip.width)).toBeLessThan(40);
  expect(skip.y - stage.y).toBeLessThan(40);
  await page.getByTestId('tutorial-skip').click();
  await expect(guide).toBeHidden();
  await expect.poll(async () => (await state(page)).paused).toBe(false);
  await expect.poll(async () => page.evaluate(() => (window.__GGC__!.state() as { simT: number }).simT)).toBeGreaterThan(simT);
});
