'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GAME_CONFIG } from '@/game/config';
import { ROLES, ROLE_DESCRIPTIONS, type PlayerRole } from '@/lib/types';
import styles from './how-to-play.module.css';

const GAME_LIMITS = {
  winsRequired: GAME_CONFIG.goodWinsForAssassination,
  delaysToLose: GAME_CONFIG.badWinRejectedTeams,
} as const;
const SPRINT_SIZES = GAME_CONFIG.sprintSizes;
const REQUIRES_DOUBLE_FAIL: readonly number[] = [7, 8, 9, 10];

type Language = 'vi' | 'en';

type GuideCopy = {
  fieldGuide: string;
  lobby: string;
  language: string;
  hero: string;
  lede: string;
  players: string;
  sprints: string;
  objectiveTitle: string;
  objectiveBody: string;
  goodWin: string;
  badWin: string;
  finalGuess: string;
  sprintFlowTitle: string;
  sprintFlowBody: string;
  steps: Array<{ title: string; body: string; note: string }>;
  teamTitle: string;
  teamBody: string;
  playerCount: string;
  doubleFail: string;
  rolesTitle: string;
  rolesBody: string;
  goodTeam: string;
  badTeam: string;
  rolesHint: string;
  readyTitle: string;
  readyBody: string;
  start: string;
  footer: string;
};

const guideCopy: Record<Language, GuideCopy> = {
  vi: {
    fieldGuide: 'SỔ TAY NHẬP MÔN',
    lobby: 'Về sảnh',
    language: 'Ngôn ngữ hướng dẫn',
    hero: 'Tập hợp đội. Cứu dự án.',
    lede: 'Say Agile One More Time là trò chơi suy luận xã hội cho team Scrum. Mỗi người có một vai trò bí mật; mọi cuộc họp và mọi lá phiếu Sprint đều có thể đổi cục diện.',
    players: '5–10 người chơi',
    sprints: '4 Sprint chính + 1 tiebreak nếu hòa',
    objectiveTitle: 'Mục tiêu của cả bàn',
    objectiveBody: 'Bạn thuộc một trong hai phe bí mật. Scrum Team phối hợp để hoàn thành dự án. Team Phá Dự Án cố gắng làm cháy deadline, kéo dài tranh cãi, hoặc lật kèo ở phút cuối.',
    goodWin: `Scrum Team cần hoàn thành ${GAME_LIMITS.winsRequired} Sprint. Sau đó, Người trễ task có một lần chỉ điểm Scrum Master. Đoán sai, Scrum Team thắng.`,
    badWin: `Team Phá Dự Án thắng khi có ${GAME_LIMITS.winsRequired} Sprint cháy deadline, hoặc khi đội bác bỏ đề xuất đủ ${GAME_LIMITS.delaysToLose} lần.`,
    finalGuess: `Nếu sau Sprint 4 hai phe hòa 2–2, bàn chơi thêm Sprint 5 với quy mô đội của Sprint 4 để phân định.`,
    sprintFlowTitle: 'Một Sprint diễn ra thế nào',
    sprintFlowBody: 'Bốn Sprint lặp lại cùng một nhịp. Product Owner luân phiên dẫn dắt, nhưng mọi người phải đọc được động cơ phía sau mỗi đề xuất.',
    steps: [
      { title: 'Planning', body: 'Product Owner đề xuất đúng số người cho Sprint. Cả bàn thảo luận, nghi ngờ và dùng kỹ năng nếu thời điểm cho phép.', note: 'Ai cũng có thể chất vấn đội hình.' },
      { title: 'Duyệt nhóm', body: 'Tất cả người chơi biểu quyết đồng ý hoặc từ chối. Hòa hoặc nhiều phiếu từ chối hơn nghĩa là nhóm bị bác bỏ.', note: 'Mỗi lần bác bỏ tăng thanh Hoãn Sprint.' },
      { title: 'Thực thi bí mật', body: 'Chỉ người trong đội được duyệt mới bỏ phiếu. Phiếu được trộn rồi công bố, nên kết quả không tiết lộ ai đã chọn gì.', note: 'Kết quả là Hoàn thành hoặc Cháy deadline.' },
    ],
    teamTitle: 'Quy mô đội Sprint',
    teamBody: 'Product Owner phải chọn đúng số người theo tổng số người chơi. Ở Sprint 3 của bàn 7–10 người, cần ít nhất hai phiếu Fail để làm Sprint thất bại.',
    playerCount: 'Người chơi',
    doubleFail: '2 Fail',
    rolesTitle: 'Vai trò là thông tin bí mật',
    rolesBody: 'Bạn chỉ biết vai trò của mình, trừ khi kỹ năng nói khác. Mở từng vai trò để biết mục tiêu và thời điểm quan trọng.',
    goodTeam: 'Scrum Team · Phe tốt',
    badTeam: 'Team Phá Dự Án · Phe xấu',
    rolesHint: 'Mỗi phòng chỉ dùng các vai trò mà host đã cấu hình.',
    readyTitle: 'Đã rõ cách chơi?',
    readyBody: 'Quay về sảnh, nhập tên duy nhất của bạn và tham gia cùng cả đội.',
    start: 'Vào sảnh',
    footer: 'Say Agile One More Time · Một ván Scrum đầy nghi vấn.',
  },
  en: {
    fieldGuide: 'FIELD GUIDE',
    lobby: 'Back to lobby',
    language: 'Guide language',
    hero: 'Assemble the team. Save the project.',
    lede: 'Say Agile One More Time is a Scrum-flavoured social deduction game. Every player has a secret role; every planning meeting and Sprint vote can change the outcome.',
    players: '5–10 players',
    sprints: '4 regular Sprints + 1 tiebreak if tied',
    objectiveTitle: 'The table’s objective',
    objectiveBody: 'You belong to one of two hidden teams. The Scrum Team tries to deliver the project. The Disruption Team tries to burn deadlines, prolong disagreement, or reverse the result at the end.',
    goodWin: `The Scrum Team must complete ${GAME_LIMITS.winsRequired} Sprints. Then the Delayed Task gets one chance to identify the Scrum Master. A wrong guess gives the Scrum Team the win.`,
    badWin: `The Disruption Team wins after ${GAME_LIMITS.winsRequired} failed Sprints or ${GAME_LIMITS.delaysToLose} rejected team proposals.`,
    finalGuess: `If the score is 2–2 after Sprint 4, play a fifth tiebreak Sprint using Sprint 4's team size.`,
    sprintFlowTitle: 'How a Sprint works',
    sprintFlowBody: 'All four Sprints follow the same rhythm. The Product Owner rotates, but everyone must read the motive behind every proposed team.',
    steps: [
      { title: 'Planning', body: 'The Product Owner proposes exactly the required number of people. The table discusses, challenges the team, and uses skills when timing allows.', note: 'Anyone can question the line-up.' },
      { title: 'Team approval', body: 'Everyone votes to approve or reject the proposal. A tie or more rejections means the team is rejected.', note: 'Every rejection advances the Delay track.' },
      { title: 'Secret execution', body: 'Only approved team members vote. Votes are shuffled before reveal, so the result does not reveal who chose what.', note: 'A Sprint is either a Success or a Deadline Burn.' },
    ],
    teamTitle: 'Sprint team sizes',
    teamBody: 'The Product Owner must choose the exact size for the player count. On Sprint 3 with 7–10 players, at least two Fail votes are required to fail the Sprint.',
    playerCount: 'Players',
    doubleFail: '2 Fails',
    rolesTitle: 'Roles are secret information',
    rolesBody: 'You know only your own role unless a skill says otherwise. Open a role to see its purpose and critical timing.',
    goodTeam: 'Scrum Team · Good team',
    badTeam: 'Disruption Team · Bad team',
    rolesHint: 'Each room only uses the roles selected by its host.',
    readyTitle: 'Ready to play?',
    readyBody: 'Return to the lobby, enter your unique display name, and join the team.',
    start: 'Enter lobby',
    footer: 'Say Agile One More Time · A Scrum game of suspicion.',
  },
};

const englishRoles: Record<PlayerRole, { name: string; description: string }> = {
  'Scrum Master': { name: 'Scrum Master', description: 'At the start of the game, you secretly know the Disruption Team. Guide the table without exposing who you are.' },
  'Project Manager': { name: 'Project Manager', description: 'Once per game, before a Sprint, you can directly appoint its team. This skips the Product Owner’s proposal and the approval vote.' },
  'Developer': { name: 'Developer', description: 'Your execution vote is forced to Success. Your approval vote still helps decide whether a proposed team runs the Sprint.' },
  'Business Analyst': { name: 'Business Analyst', description: 'Once per game, check two players. The result is Yes if at least one belongs to the Disruption Team; otherwise it is No.' },
  'Quality Controller': { name: 'Quality Controller', description: 'Once per game, after a Sprint result is announced, cancel that result and restart the Sprint from planning.' },
  'Technical Leader': { name: 'Technical Leader', description: 'If you are on a Sprint team and it has exactly one Fail vote, that Fail automatically becomes a Success.' },
  'Data Analyst': { name: 'Data Analyst', description: 'From Sprint 2 onward, once per game, inspect one player from the previous Sprint to learn whether they voted Success or Deadline Burn.' },
  'Thực tập sinh': { name: 'Intern', description: 'At the start of the game, choose one player to follow. From Sprint 2, that player’s approval vote counts twice.' },
  'Người trễ task': { name: 'Delayed Task', description: 'You can cast a Deadline Burn vote during execution. If the Scrum Team reaches its target, you get one final chance to identify the Scrum Master.' },
  'Client': { name: 'Client', description: 'You know who the Business Analyst is from the start. Use that knowledge to misdirect the table.' },
  'Ông sếp khó ưa': { name: 'Difficult Boss', description: 'Before each Sprint, choose one player who cannot chat or cast an approval vote during that Sprint’s planning.' },
  'Kẻ fake CV': { name: 'Fake CV', description: 'When the Scrum Master or Business Analyst checks you, the system reports you as part of the Scrum Team.' },
  'QC cẩu thả': { name: 'Careless QC', description: 'When you join a Sprint and vote Deadline Burn, your vote counts as two Fail votes.' },
  'Deadline': { name: 'Deadline', description: 'Once per game, silence every player for one Sprint’s planning phase.' },
  'Technical Debt': { name: 'Technical Debt', description: 'If you join the current Sprint, the next Sprint must include one additional team member.' },
};

function roleLabel(role: PlayerRole, language: Language) {
  return language === 'vi' ? role : englishRoles[role].name;
}

function roleDescription(role: PlayerRole, language: Language) {
  return language === 'vi' ? ROLE_DESCRIPTIONS[role] : englishRoles[role].description;
}

export default function HowToPlayPage() {
  const [language, setLanguage] = useState<Language>('vi');
  const copy = guideCopy[language];

  return (
    <main className={styles.page} lang={language}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>Say Agile One More Time</Link>
        <Link href="/" className={styles.navAction}>{copy.lobby} <span aria-hidden="true">→</span></Link>
      </header>

      <section className={styles.hero} aria-labelledby="guide-title">
        <div className={styles.heroMeta}>
          <span>{copy.fieldGuide}</span>
          <span aria-hidden="true">•</span>
          <span>{copy.sprints}</span>
        </div>
        <h1 id="guide-title">{copy.hero}</h1>
        <p className={styles.lede}>{copy.lede}</p>
        <div className={styles.heroFacts} aria-label={language === 'vi' ? 'Thông tin ván chơi' : 'Game facts'}>
          <span>{copy.players}</span>
          <span>{copy.sprints}</span>
          <span>{GAME_LIMITS.winsRequired}/4+1 {language === 'vi' ? 'Sprint để thắng' : 'Sprints to win'}</span>
        </div>
      </section>

      <section className={styles.languageBar} aria-label={copy.language}>
        <span>{copy.language}</span>
        <div className={styles.languageToggle} role="group" aria-label={copy.language}>
          <button type="button" aria-pressed={language === 'vi'} onClick={() => setLanguage('vi')}>Tiếng Việt</button>
          <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
        </div>
      </section>

      <article className={styles.guide}>
        <section className={styles.objective} aria-labelledby="objective-title">
          <h2 id="objective-title">{copy.objectiveTitle}</h2>
          <p>{copy.objectiveBody}</p>
          <ul className={styles.outcomes}>
            <li><span className={styles.goodMarker} aria-hidden="true" />{copy.goodWin}</li>
            <li><span className={styles.badMarker} aria-hidden="true" />{copy.badWin}</li>
            <li><span className={styles.neutralMarker} aria-hidden="true" />{copy.finalGuess}</li>
          </ul>
        </section>

        <section className={styles.workflow} aria-labelledby="workflow-title">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionNumber}>01</p>
            <div>
              <h2 id="workflow-title">{copy.sprintFlowTitle}</h2>
              <p>{copy.sprintFlowBody}</p>
            </div>
          </div>
          <ol className={styles.steps}>
            {copy.steps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepNumber}>{index + 1}.0</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <p className={styles.stepNote}>{step.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.teamSizes} aria-labelledby="team-size-title">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionNumber}>02</p>
            <div>
              <h2 id="team-size-title">{copy.teamTitle}</h2>
              <p>{copy.teamBody}</p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">{copy.playerCount}</th>
                  {[1, 2, 3, 4].map((sprint) => <th key={sprint} scope="col">Sprint {sprint}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(SPRINT_SIZES).map(([playerCount, teamSizes]) => (
                  <tr key={playerCount}>
                    <th scope="row">{playerCount}</th>
                    {teamSizes.map((teamSize, sprintIndex) => (
                      <td key={sprintIndex} data-label={`Sprint ${sprintIndex + 1}`}>
                        <strong>{teamSize}</strong>
                        {REQUIRES_DOUBLE_FAIL.includes(Number(playerCount)) && sprintIndex === 2 && (
                          <span>{copy.doubleFail}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.roles} aria-labelledby="roles-title">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionNumber}>03</p>
            <div>
              <h2 id="roles-title">{copy.rolesTitle}</h2>
              <p>{copy.rolesBody}</p>
            </div>
          </div>
          <div className={styles.roleGroups}>
            <section className={styles.roleGroup} aria-labelledby="good-team-title">
              <h3 id="good-team-title"><span className={styles.goodMarker} aria-hidden="true" />{copy.goodTeam}</h3>
              {ROLES.GOOD.map((role) => (
                <details key={role}>
                  <summary><span>{roleLabel(role, language)}</span><span aria-hidden="true">+</span></summary>
                  <p>{roleDescription(role, language)}</p>
                </details>
              ))}
            </section>
            <section className={styles.roleGroup} aria-labelledby="bad-team-title">
              <h3 id="bad-team-title"><span className={styles.badMarker} aria-hidden="true" />{copy.badTeam}</h3>
              {ROLES.BAD.map((role) => (
                <details key={role}>
                  <summary><span>{roleLabel(role, language)}</span><span aria-hidden="true">+</span></summary>
                  <p>{roleDescription(role, language)}</p>
                </details>
              ))}
            </section>
          </div>
          <p className={styles.rolesHint}>{copy.rolesHint}</p>
        </section>

        <section className={styles.ready} aria-labelledby="ready-title">
          <p className={styles.sectionNumber}>04</p>
          <h2 id="ready-title">{copy.readyTitle}</h2>
          <p>{copy.readyBody}</p>
          <Link href="/" className={styles.startLink}>{copy.start} <span aria-hidden="true">→</span></Link>
        </section>
      </article>

      <footer className={styles.footer}>
        <p>{copy.footer}</p>
      </footer>
    </main>
  );
}
