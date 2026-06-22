const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// ============ GAME CONSTANTS ============
const SPRINT_SIZES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4], // Sprint 3 requires 2 fails
  8: [3, 4, 4, 5, 5], // Sprint 3 requires 2 fails
  9: [3, 4, 4, 5, 5], // Sprint 3 requires 2 fails
  10: [3, 4, 5, 6, 6] // Sprint 3 requires 2 fails
};

const REQUIRES_DOUBLE_FAIL = [7, 8, 9, 10]; // Player counts where sprint 3 needs 2 fails

const ROLES = {
  GOOD: ['Scrum Master', 'Project Manager', 'Developer', 'Business Analyst', 'Tech Lead', 'Data Analyst'],
  BAD: ['Người trễ task', 'QC cẩu thả']
};

// ============ GAME STATE ============
const rooms = new Map();

function createRoom(roomId) {
  return {
    id: roomId,
    players: [], // { id, name, role, isAlive, socketId }
    phase: 'lobby', // lobby, planning, teamVoting, execution, ended
    currentPO: 0, // index in players
    currentSprint: 0, // 0-4
    proposedTeam: [], // player ids for current sprint
    votes: {}, // playerId -> vote for team voting
    executionVotes: {}, // playerId -> vote for execution
    consecutiveDelays: 0,
    goodWins: 0,
    badWins: 0,
    saboteurGuess: null, // for end game saboteur guess
    pmOverrideUsed: false,
    dataAnalystCheckUsed: false,
    techLeadPresent: false,
    qcBugged: false // if QC cẩu thả was on previous sprint
  };
}

function assignRoles(room) {
  const playerCount = room.players.length;
  const goodCount = Math.floor(playerCount * 0.6); // 60% good
  const badCount = playerCount - goodCount;

  // Assign GOOD roles
  const goodRoles = shuffleArray([...ROLES.GOOD]).slice(0, goodCount);

  // Assign BAD roles - scale up if needed (duplicate role types)
  const badRolesPool = [];
  while (badRolesPool.length < badCount) {
    badRolesPool.push(...ROLES.BAD);
  }
  const badRoles = shuffleArray(badRolesPool).slice(0, badCount);

  const allRoles = [...goodRoles, ...badRoles];
  const shuffledRoles = shuffleArray(allRoles);

  room.players.forEach((player, index) => {
    player.role = shuffledRoles[index];
    player.isAlive = true;
  });
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getSaboteurs(room) {
  return room.players.filter(p => p.role === 'Người trễ task');
}

function getTechLead(room) {
  return room.players.find(p => p.role === 'Tech Lead');
}

function getQC(room) {
  return room.players.find(p => p.role === 'QC cẩu thả');
}

function getPlayerById(room, playerId) {
  return room.players.find(p => p.id === playerId);
}

function getCurrentPO(room) {
  return room.players[room.currentPO];
}

function getSprintSize(room) {
  return SPRINT_SIZES[room.players.length]?.[room.currentSprint] || 3;
}

function requiresDoubleFail(room) {
  return REQUIRES_DOUBLE_FAIL.includes(room.players.length) && room.currentSprint === 2;
}

// ============ SOCKET HANDLERS ============
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('createRoom', ({ roomId, playerName }) => {
    if (rooms.has(roomId)) {
      socket.emit('error', { message: 'Room already exists' });
      return;
    }

    const room = createRoom(roomId);
    const player = { id: socket.id, name: playerName, role: null, isAlive: true, socketId: socket.id };
    room.players.push(player);
    rooms.set(roomId, room);

    socket.join(roomId);
    socket.emit('roomCreated', { roomId, playerId: socket.id });
    io.to(roomId).emit('playerJoined', { player, players: room.players });
    console.log(`Room ${roomId} created by ${playerName}`);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.phase !== 'lobby') {
      socket.emit('error', { message: 'Game already started' });
      return;
    }
    if (room.players.length >= 10) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const player = { id: socket.id, name: playerName, role: null, isAlive: true, socketId: socket.id };
    room.players.push(player);

    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: socket.id });
    io.to(roomId).emit('playerJoined', { player, players: room.players });
    console.log(`${playerName} joined room ${roomId}`);
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.players.length < 5) {
      socket.emit('error', { message: 'Need at least 5 players' });
      return;
    }

    assignRoles(room);
    room.phase = 'planning';

    // Tell each player their role (only they see their own role)
    room.players.forEach(player => {
      io.to(player.socketId).emit('roleAssigned', {
        role: player.role,
        isGood: !ROLES.BAD.includes(player.role)
      });
    });

    // Tell saboteurs who other saboteurs are
    const saboteurs = getSaboteurs(room);
    if (saboteurs.length > 0) {
      saboteurs.forEach(sab => {
        io.to(sab.socketId).emit('saboteursRevealed', {
          saboteurIds: saboteurs.filter(s => s.id !== sab.id).map(s => s.id)
        });
      });
    }

    // Tell BA who the Client is (Dev or SM based on game rules - simplified)
    const BA = room.players.find(p => p.role === 'Business Analyst');
    if (BA) {
      const client = room.players.find(p => p.role === 'Developer' || p.role === 'Tech Lead');
      if (client) {
        io.to(BA.socketId).emit('clientRevealed', { clientId: client.id });
      }
    }

    // Tell SM who saboteurs are
    const SM = room.players.find(p => p.role === 'Scrum Master');
    if (SM) {
      io.to(SM.socketId).emit('saboteursRevealed', {
        saboteurIds: saboteurs.map(s => s.id)
      });
    }

    io.to(roomId).emit('gameStarted', {
      players: room.players.map(p => ({ id: p.id, name: p.name, isAlive: p.isAlive })),
      currentPO: getCurrentPO(room),
      currentSprint: room.currentSprint
    });

    io.to(roomId).emit('phaseChanged', { phase: 'planning' });
    console.log(`Game started in room ${roomId}`);
  });

  socket.on('proposeTeam', ({ roomId, playerIds }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const PO = getCurrentPO(room);
    if (PO.id !== socket.id) {
      socket.emit('error', { message: 'Only PO can propose team' });
      return;
    }

    room.proposedTeam = playerIds;
    room.votes = {};
    room.executionVotes = {};
    room.phase = 'teamVoting';

    io.to(roomId).emit('teamProposed', { proposedTeam: playerIds });
    io.to(roomId).emit('phaseChanged', { phase: 'teamVoting' });
  });

  socket.on('voteTeam', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.phase !== 'teamVoting') {
      socket.emit('error', { message: 'Not in voting phase' });
      return;
    }

    if (room.votes[socket.id]) {
      socket.emit('error', { message: 'Already voted' });
      return;
    }

    room.votes[socket.id] = vote;

    io.to(roomId).emit('voteReceived', {
      playerId: socket.id,
      vote,
      voteCount: Object.keys(room.votes).length,
      totalPlayers: room.players.filter(p => p.isAlive).length
    });

    // Check if all voted
    const alivePlayers = room.players.filter(p => p.isAlive);
    if (Object.keys(room.votes).length === alivePlayers.length) {
      tallyTeamVote(room);
    }
  });

  function tallyTeamVote(room) {
    const votes = Object.values(room.votes);
    const agree = votes.filter(v => v === 'agree').length;
    const reject = votes.filter(v => v === 'reject').length;

    if (agree > reject) {
      // Team accepted, move to execution
      room.phase = 'execution';
      room.consecutiveDelays = 0;

      // Check for Tech Lead
      room.techLeadPresent = room.proposedTeam.some(id => {
        const p = getPlayerById(room, id);
        return p && p.role === 'Tech Lead';
      });

      // Check for QC cẩu thả (bug from previous sprint)
      if (room.qcBugged) {
        // QC caused bugs, this sprint fails
        room.phase = 'sprintResult';
        room.badWins++;
        room.qcBugged = false;
        io.to(room.id).emit('sprintFailed', { reason: 'Hidden bugs from QC' });
        checkWinCondition(room);
        return;
      }

      io.to(room.id).emit('teamAccepted');
      io.to(room.id).emit('phaseChanged', { phase: 'execution' });
    } else {
      // Team rejected
      room.consecutiveDelays++;
      room.currentPO = (room.currentPO + 1) % room.players.length;

      if (room.consecutiveDelays >= 4) {
        // Bad guys win
        room.phase = 'ended';
        room.badWins = 3;
        io.to(room.id).emit('gameEnded', { winner: 'bad', reason: '4 consecutive delays' });
      } else {
        room.phase = 'planning';
        io.to(room.id).emit('teamRejected');
        io.to(room.id).emit('phaseChanged', { phase: 'planning' });
        io.to(room.id).emit('newPO', { currentPO: getCurrentPO(room) });
      }
    }
  }

  socket.on('voteExecution', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.phase !== 'execution') {
      socket.emit('error', { message: 'Not in execution phase' });
      return;
    }

    if (!room.proposedTeam.includes(socket.id)) {
      socket.emit('error', { message: 'Only team members can vote' });
      return;
    }

    if (room.executionVotes[socket.id]) {
      socket.emit('error', { message: 'Already voted' });
      return;
    }

    // Good guys must vote success
    const player = getPlayerById(room, socket.id);
    if (!ROLES.BAD.includes(player.role) && vote === 'fail') {
      socket.emit('error', { message: 'Good guys must vote success' });
      return;
    }

    room.executionVotes[socket.id] = vote;

    io.to(roomId).emit('executionVoteReceived', {
      playerId: socket.id,
      voteCount: Object.keys(room.executionVotes).length,
      totalVoters: room.proposedTeam.length
    });

    // Check if all voted
    if (Object.keys(room.executionVotes).length === room.proposedTeam.length) {
      tallyExecutionVote(room);
    }
  });

  function tallyExecutionVote(room) {
    const votes = Object.values(room.executionVotes);
    const fails = votes.filter(v => v === 'fail').length;
    const success = votes.filter(v => v === 'success').length;

    room.phase = 'sprintResult';

    // Check for QC cẩu thả on this sprint - sets bug for NEXT sprint
    const QC = getQC(room);
    if (QC && room.proposedTeam.includes(QC.id)) {
      room.qcBugged = true;
    }

    const doubleFail = requiresDoubleFail(room);
    const sprintFailed = doubleFail ? fails >= 2 : fails >= 1;

    // Tech Lead prevents failure
    if (sprintFailed && room.techLeadPresent) {
      sprintFailed = false;
      io.to(room.id).emit('techLeadSaved');
    }

    if (sprintFailed) {
      room.badWins++;
      io.to(room.id).emit('sprintFailed', {
        fails,
        doubleFail,
        reason: doubleFail ? '2+ fail votes' : '1+ fail votes'
      });
    } else {
      room.goodWins++;
      io.to(room.id).emit('sprintSuccess', { success, fails });
    }

    room.currentSprint++;
    checkWinCondition(room);
  }

  function checkWinCondition(room) {
    if (room.badWins >= 3) {
      room.phase = 'ended';
      // Saboteur can guess SM
      const saboteurs = getSaboteurs(room);
      if (saboteurs.length > 0) {
        io.to(room.id).emit('saboteurGuessPhase', {
          saboteurIds: saboteurs.map(s => s.id)
        });
      } else {
        io.to(room.id).emit('gameEnded', { winner: 'bad' });
      }
      return;
    }

    if (room.goodWins >= 3) {
      room.phase = 'ended';
      io.to(room.id).emit('gameEnded', { winner: 'good' });
      return;
    }

    if (room.currentSprint >= 5) {
      room.phase = 'ended';
      // If we reach sprint 5 and neither has 3, more bad wins = bad wins
      if (room.badWins > room.goodWins) {
        io.to(room.id).emit('gameEnded', { winner: 'bad' });
      } else {
        io.to(room.id).emit('gameEnded', { winner: 'good' });
      }
      return;
    }

    // Next sprint planning
    room.phase = 'planning';
    room.proposedTeam = [];
    room.votes = {};
    room.executionVotes = {};
    room.techLeadPresent = false;

    io.to(room.id).emit('nextSprint', {
      currentSprint: room.currentSprint,
      sprintSize: getSprintSize(room)
    });
    io.to(room.id).emit('phaseChanged', { phase: 'planning' });
    io.to(room.id).emit('newPO', { currentPO: getCurrentPO(room) });
  }

  socket.on('saboteurGuess', ({ roomId, guessedSmId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const saboteur = getSaboteurs(room).find(s => s.id === socket.id);
    if (!saboteur) {
      socket.emit('error', { message: 'Only saboteurs can guess' });
      return;
    }

    const SM = room.players.find(p => p.role === 'Scrum Master');
    if (SM && SM.id === guessedSmId) {
      room.phase = 'ended';
      io.to(room.id).emit('gameEnded', { winner: 'bad', reason: 'Saboteur guessed SM correctly' });
    } else {
      room.phase = 'ended';
      io.to(room.id).emit('gameEnded', { winner: 'good', reason: 'Saboteur guessed SM incorrectly' });
    }
  });

  socket.on('pmOverride', ({ roomId, playerIds }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const PM = room.players.find(p => p.role === 'Project Manager' && p.id === socket.id);
    if (!PM) {
      socket.emit('error', { message: 'Only PM can override' });
      return;
    }
    if (room.pmOverrideUsed) {
      socket.emit('error', { message: 'PM override already used' });
      return;
    }

    room.pmOverrideUsed = true;
    room.proposedTeam = playerIds;
    room.phase = 'teamVoting';

    io.to(roomId).emit('pmOverrideUsed', { by: PM.name });
    io.to(roomId).emit('teamProposed', { proposedTeam: playerIds });
    io.to(roomId).emit('phaseChanged', { phase: 'teamVoting' });
  });

  socket.on('dataAnalystCheck', ({ roomId, targetPlayerId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const DA = room.players.find(p => p.role === 'Data Analyst' && p.id === socket.id);
    if (!DA) {
      socket.emit('error', { message: 'Only Data Analyst can check' });
      return;
    }
    if (room.dataAnalystCheckUsed) {
      socket.emit('error', { message: 'Data Analyst check already used' });
      return;
    }

    room.dataAnalystCheckUsed = true;
    const target = getPlayerById(room, targetPlayerId);

    if (target) {
      // Check would need vote history - simplified for now
      io.to(DA.socketId).emit('dataAnalystResult', {
        targetId: targetPlayerId,
        isGood: !ROLES.BAD.includes(target.role)
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Handle player leaving - remove from room
    for (const [roomId, room] of rooms) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('playerLeft', { player });

        // If game in progress, mark as left
        if (room.phase !== 'lobby' && room.phase !== 'ended') {
          player.isAlive = false;
          io.to(roomId).emit('playerDied', { playerId: socket.id });
        }

        // Adjust PO index if needed
        if (room.currentPO >= room.players.length) {
          room.currentPO = 0;
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io, httpServer };
