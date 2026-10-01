// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ReactionBar } from './ReactionBar';

afterEach(() => cleanup());

it('sends the selected emoji to the selected public target', async () => {
  const onReact = vi.fn();
  render(<ReactionBar
    players={[{ id: 'p1', name: 'An' }]}
    proposalAvailable
    resultAvailable={false}
    onReact={onReact}
  />);

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Đối tượng cảm xúc' }), 'proposal');
  await userEvent.click(screen.getByRole('button', { name: 'Gửi 🔥 cho Đề xuất đội' }));
  expect(onReact).toHaveBeenCalledWith('🔥', 'proposal', undefined);

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Đối tượng cảm xúc' }), 'player:p1');
  await userEvent.click(screen.getByRole('button', { name: 'Gửi 👀 cho An' }));
  expect(onReact).toHaveBeenCalledWith('👀', 'player', 'p1');
});
