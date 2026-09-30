// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamVoteBoard } from './TeamVoteBoard';

describe('TeamVoteBoard', () => {
  const players = [
    { id: 'p1', name: 'An' },
    { id: 'p2', name: 'Bình' },
  ];

  it('keeps individual choices hidden while voters are submitting', () => {
    render(
      <TeamVoteBoard
        state={{
          kind: 'voting',
          players,
          eligibleIds: ['p1', 'p2'],
          submittedIds: ['p1'],
          pendingIds: ['p2'],
          viewerId: 'p1',
        }}
      />
    );

    expect(screen.getByText('An (bạn)')).toBeTruthy();
    expect(screen.getByText('Đã bỏ phiếu')).toBeTruthy();
    expect(screen.getByText('Đang chờ')).toBeTruthy();
    expect(screen.queryByText('Đồng ý')).toBeNull();
    expect(screen.queryByText('Từ chối')).toBeNull();
  });

  it('reveals every eligible choice together after voting closes', () => {
    render(
      <TeamVoteBoard
        state={{
          kind: 'reveal',
          players,
          choices: { p1: 'approve', p2: 'reject' },
          accepted: false,
          approveWeight: 1,
          rejectWeight: 1,
        }}
      />
    );

    expect(screen.getByText('An')).toBeTruthy();
    expect(screen.getAllByText('Bình')).toHaveLength(2);
    expect(screen.getByText('Đồng ý')).toBeTruthy();
    expect(screen.getAllByText('Từ chối').length).toBeGreaterThan(0);
    expect(screen.getByText('Nhóm chưa được duyệt')).toBeTruthy();
  });

  it('shows the effective weighted tally when the intern multiplier changes the result', () => {
    render(<TeamVoteBoard state={{
      kind: 'reveal',
      players: [
        { id: 'p1', name: 'An' }, { id: 'p2', name: 'Bình' }, { id: 'p3', name: 'Chi' },
        { id: 'p4', name: 'Dũng' }, { id: 'p5', name: 'Hà' },
      ],
      choices: { p1: 'approve', p2: 'approve', p3: 'reject', p4: 'reject', p5: 'reject' },
      approveWeight: 3,
      rejectWeight: 3,
      accepted: false,
    }} />);
    expect(screen.getByText('Hiệu lực đồng ý 3')).toBeTruthy();
    expect(screen.getByText('Hiệu lực từ chối 3')).toBeTruthy();
    expect(screen.getByText('5 người đã bỏ phiếu; kỹ năng có thể đổi trọng số.')).toBeTruthy();
  });
});
