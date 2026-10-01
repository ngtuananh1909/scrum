import { expect, test } from '@playwright/test';

test('five isolated players start a game and complete a Sprint through the result', async ({ browser }) => {
  test.setTimeout(600_000);

  const contexts = await Promise.all(Array.from({ length: 5 }, (_, index) => browser.newContext(index === 0
    ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }
    : {})));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const playerNames = Array.from({ length: 5 }, (_, index) => `E2E Player ${index + 1}`);

  try {
    const hostPage = pages[0];
    if (!hostPage) throw new Error('The host page was not created.');

    await hostPage.goto('/');
    await hostPage.getByLabel('Biệt danh').fill(playerNames[0]!);
    await hostPage.getByRole('button', { name: 'Tạo phòng mới' }).click();
    await expect(hostPage).toHaveURL(/\/game\/[A-Za-z0-9_-]+$/, { timeout: 30_000 });

    const roomId = new URL(hostPage.url()).pathname.split('/').at(-1);
    if (!roomId) throw new Error('The host was not redirected to a room.');
    await expect(hostPage.getByRole('heading', { name: 'Danh sách phòng' })).toBeVisible();
    expect(await hostPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await Promise.all(
      pages.slice(1).map(async (page, index) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Tham gia' }).click();
        await page.getByLabel('Biệt danh').fill(playerNames[index + 1]!);
        await page.getByLabel('Mã phòng').fill(roomId);
        await page.getByRole('button', { name: 'Vào phòng' }).click();
        await expect(page).toHaveURL(new RegExp(`/game/${roomId}$`), { timeout: 30_000 });
      })
    );

    await expect(hostPage.getByText('5/10', { exact: true })).toBeVisible({ timeout: 45_000 });
    const lobbyRegion = hostPage.getByRole('region', { name: 'Phòng chơi' });
    for (const [index, playerName] of playerNames.entries()) {
      const rosterName = index === 0
        ? lobbyRegion.getByText(new RegExp(`^${playerName}\\s*\\(Bạn\\)$`))
        : lobbyRegion.getByText(playerName, { exact: true });
      await expect(rosterName).toBeVisible({ timeout: 15_000 });
    }

    await Promise.all(pages.map(async (page) => {
      const readyButton = page.getByRole('button', { name: 'Tôi đã sẵn sàng' });
      await expect(readyButton).toBeEnabled();
      await readyButton.click();
      await expect(page.getByRole('button', { name: 'Chưa sẵn sàng' })).toBeVisible();
    }));

    const beginnerPreset = hostPage.getByRole('button', { name: /^Cơ bản/ });
    if (await beginnerPreset.isEnabled()) await beginnerPreset.click();
    await expect(beginnerPreset).toHaveAttribute('aria-pressed', 'true');

    const startButton = hostPage.getByRole('button', { name: 'Bắt đầu ván' });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    await Promise.all(pages.map(async (page) => {
      const roleDialog = page.getByRole('dialog');
      await expect(roleDialog.getByRole('heading', { name: 'Vai trò của bạn', exact: true }))
        .toBeVisible({ timeout: 30_000 });
      await roleDialog.getByRole('button', { name: 'Tôi đã nhớ vai trò' }).click();
    }));

    const gameBoard = hostPage.locator('#game-board');
    await expect(gameBoard.getByRole('heading', { name: 'Giờ tan ca đầu tiên' })).toBeVisible({ timeout: 90_000 });

    await expect(gameBoard.getByRole('heading', { name: 'Thảo luận trước khi chọn đội' }))
      .toBeVisible({ timeout: 60_000 });
    await expect(gameBoard.getByRole('heading', { name: 'Sprint 1 · Chọn đội' }))
      .toBeVisible({ timeout: 240_000 });
    expect(await hostPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const team = [playerNames[0]!, playerNames[1]!];
    for (const playerName of team) {
      await hostPage.getByRole('button', { name: `Chọn ${playerName}` }).click();
    }
    await hostPage.getByRole('button', { name: 'Chốt đội hình' }).click();

    await Promise.all(pages.map(async (page) => {
      const approveButton = page.getByRole('button', { name: 'Đồng ý', exact: true });
      await expect(approveButton).toBeVisible({ timeout: 30_000 });
      await approveButton.click();
    }));

    await expect(gameBoard.getByRole('heading', { name: 'Nhóm được duyệt' })).toBeVisible({ timeout: 20_000 });

    for (const playerIndex of [0, 1]) {
      const page = pages[playerIndex];
      if (!page) throw new Error(`The selected team player ${playerIndex + 1} page is missing.`);
      const completeButton = page.getByRole('button', { name: 'Hoàn thành', exact: true });
      await expect(completeButton).toBeVisible({ timeout: 20_000 });
      await completeButton.click();
    }

    await expect(hostPage.getByText('Phiếu đã được xáo trộn', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(hostPage.getByText(/Tỉ số hiện tại:/)).toBeVisible({ timeout: 20_000 });
    await expect(gameBoard.getByRole('heading', { name: /Sprint (thành công|thất bại)/ })).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
