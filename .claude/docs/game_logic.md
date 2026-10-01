# Game Logic

[SYSTEM_BEHAVIOR_SPEC.md](../../client/docs/SYSTEM_BEHAVIOR_SPEC.md) is authoritative. The pure implementation and tests are in client/src/game. Older README and historical notes must not override the specification.

Key outcomes: three failed Sprints or four consecutive rejected teams give the bad side a win; three good Sprints open the final guess. If Sprint 4 ends 2–2, a fifth tiebreaker repeats Sprint 4's base team size. Exactly one Scrum Master and one Người trễ task are required. A missed final guess after 60 seconds gives the good side a win.

The engine separates 180-second planning discussion from 45-second PO team selection. Team-vote participation is public while choices remain hidden until the simultaneous reveal. Execution ballots stay anonymous; missing team votes become Reject, and missing execution votes become Success. Role and timeout changes require engine tests plus privacy/concurrency checks where applicable.
