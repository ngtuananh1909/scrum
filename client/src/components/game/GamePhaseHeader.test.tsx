// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GamePhaseHeader } from './GamePhaseHeader';

describe('GamePhaseHeader', () => {
  it('shows the fifth Sprint when the game enters a tiebreak', () => {
    render(
      <GamePhaseHeader
        roomId="ABCD"
        phaseLabel="Lập kế hoạch"
        title="Sprint phân định"
        instruction="Chọn đội hình cho vòng cuối."
        sprintNumber={5}
        totalSprints={5}
        goodWins={2}
        badWins={2}
        connectionStatus="connected"
      />
    );

    expect(screen.getByText('Sprint 5/5')).toBeTruthy();
    expect(screen.getByLabelText('Tiến độ Sprint 5 trên 5')).toBeTruthy();
  });
});
