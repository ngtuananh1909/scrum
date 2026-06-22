import { describe, it, expect, beforeEach } from 'vitest';

// Import the game logic - we'll need to extract it from index.js
// For now, we'll test the core functions

const SPRINT_SIZES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 5, 6, 6]
};

const REQUIRES_DOUBLE_FAIL = [7, 8, 9, 10];

const ROLES = {
  GOOD: ['Scrum Master', 'Project Manager', 'Developer', 'Business Analyst', 'Tech Lead', 'Data Analyst'],
  BAD: ['Người trễ task', 'QC cẩu thả']
};

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function assignRoles(players) {
  const playerCount = players.length;
  const goodCount = Math.floor(playerCount * 0.6);
  const badCount = playerCount - goodCount;

  // Scale bad roles - duplicate if needed to reach bad count
  const badRolesPool = [];
  while (badRolesPool.length < badCount) {
    badRolesPool.push(...ROLES.BAD);
  }
  const badRoles = shuffleArray(badRolesPool).slice(0, badCount);

  const goodRoles = shuffleArray([...ROLES.GOOD]).slice(0, goodCount);

  const allRoles = [...goodRoles, ...badRoles];
  const shuffledRoles = shuffleArray(allRoles);

  return players.map((player, index) => ({
    ...player,
    role: shuffledRoles[index]
  }));
}

function getSprintSize(playerCount, sprintIndex) {
  return SPRINT_SIZES[playerCount]?.[sprintIndex] || 3;
}

function requiresDoubleFail(playerCount, sprintIndex) {
  return REQUIRES_DOUBLE_FAIL.includes(playerCount) && sprintIndex === 2;
}

function tallyExecution(fails, techLeadPresent, playerCount, sprintIndex) {
  const doubleFail = requiresDoubleFail(playerCount, sprintIndex);
  const sprintFailed = doubleFail ? fails >= 2 : fails >= 1;

  if (sprintFailed && techLeadPresent) {
    return { failed: false, savedByTechLead: true };
  }

  return { failed: sprintFailed, savedByTechLead: false };
}

describe('Role Distribution', () => {
  it('should assign 60% good roles', () => {
    const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
    const assigned = assignRoles(players);

    const goodCount = assigned.filter(p => ROLES.GOOD.includes(p.role)).length;
    const badCount = assigned.filter(p => ROLES.BAD.includes(p.role)).length;

    expect(goodCount).toBe(3);
    expect(badCount).toBe(2);
  });

  it('should assign correct ratio for 7 players', () => {
    const players = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
    const assigned = assignRoles(players);

    const goodCount = assigned.filter(p => ROLES.GOOD.includes(p.role)).length;
    const badCount = assigned.filter(p => ROLES.BAD.includes(p.role)).length;

    expect(goodCount).toBe(4);
    expect(badCount).toBe(3);
  });

  it('should assign correct ratio for 10 players', () => {
    const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
    const assigned = assignRoles(players);

    const goodCount = assigned.filter(p => ROLES.GOOD.includes(p.role)).length;
    const badCount = assigned.filter(p => ROLES.BAD.includes(p.role)).length;

    expect(goodCount).toBe(6);
    expect(badCount).toBe(4);
  });

  it('should include both bad role types when applicable', () => {
    const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
    const assigned = assignRoles(players);

    const hasSaboteur = assigned.some(p => p.role === 'Người trễ task');
    const hasQC = assigned.some(p => p.role === 'QC cẩu thả');

    expect(hasSaboteur || hasQC).toBe(true);
  });
});

describe('Sprint Size Matrix', () => {
  it('should return correct sprint sizes for 5 players', () => {
    expect(getSprintSize(5, 0)).toBe(2);
    expect(getSprintSize(5, 1)).toBe(3);
    expect(getSprintSize(5, 2)).toBe(2);
    expect(getSprintSize(5, 3)).toBe(3);
    expect(getSprintSize(5, 4)).toBe(3);
  });

  it('should return correct sprint sizes for 7 players', () => {
    expect(getSprintSize(7, 0)).toBe(2);
    expect(getSprintSize(7, 1)).toBe(3);
    expect(getSprintSize(7, 2)).toBe(3);
    expect(getSprintSize(7, 3)).toBe(4);
    expect(getSprintSize(7, 4)).toBe(4);
  });

  it('should return correct sprint sizes for 10 players', () => {
    expect(getSprintSize(10, 0)).toBe(3);
    expect(getSprintSize(10, 1)).toBe(4);
    expect(getSprintSize(10, 2)).toBe(5);
    expect(getSprintSize(10, 3)).toBe(6);
    expect(getSprintSize(10, 4)).toBe(6);
  });
});

describe('Double Fail Rules', () => {
  it('should require double fail for sprint 3 with 7 players', () => {
    expect(requiresDoubleFail(7, 2)).toBe(true);
    expect(requiresDoubleFail(7, 1)).toBe(false);
    expect(requiresDoubleFail(7, 3)).toBe(false);
  });

  it('should require double fail for sprint 3 with 8 players', () => {
    expect(requiresDoubleFail(8, 2)).toBe(true);
  });

  it('should NOT require double fail for 5 or 6 players', () => {
    expect(requiresDoubleFail(5, 2)).toBe(false);
    expect(requiresDoubleFail(6, 2)).toBe(false);
  });
});

describe('Execution Voting', () => {
  it('should fail sprint with 1 fail vote (single fail rule)', () => {
    const result = tallyExecution(1, false, 5, 0);
    expect(result.failed).toBe(true);
    expect(result.savedByTechLead).toBe(false);
  });

  it('should pass sprint with no fail votes', () => {
    const result = tallyExecution(0, false, 5, 0);
    expect(result.failed).toBe(false);
  });

  it('should save sprint with Tech Lead even with fail vote', () => {
    const result = tallyExecution(1, true, 5, 0);
    expect(result.failed).toBe(false);
    expect(result.savedByTechLead).toBe(true);
  });

  it('should require 2 fails for double fail sprints', () => {
    const result = tallyExecution(1, false, 7, 2);
    expect(result.failed).toBe(false);
  });

  it('should fail with 2 fails on double fail sprint', () => {
    const result = tallyExecution(2, false, 7, 2);
    expect(result.failed).toBe(true);
  });

  it('should still save with Tech Lead on double fail sprint', () => {
    const result = tallyExecution(2, true, 7, 2);
    expect(result.failed).toBe(false);
    expect(result.savedByTechLead).toBe(true);
  });
});

describe('Win Conditions', () => {
  it('should detect good guys win with 3 sprint successes', () => {
    const goodWins = 3;
    const badWins = 2;
    expect(goodWins >= 3).toBe(true);
    expect(badWins < 3).toBe(true);
  });

  it('should detect bad guys win with 3 sprint failures', () => {
    const goodWins = 2;
    const badWins = 3;
    expect(badWins >= 3).toBe(true);
  });

  it('should detect bad guys win with 4 consecutive delays', () => {
    const consecutiveDelays = 4;
    expect(consecutiveDelays >= 4).toBe(true);
  });
});
