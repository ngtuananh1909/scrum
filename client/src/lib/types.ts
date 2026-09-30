import { BAD_ROLES, GOOD_ROLES, type GameRole } from '@/game';

// UI copy and lobby count shape only. Gameplay constants live in src/game.
export const ROLES = { GOOD: GOOD_ROLES, BAD: BAD_ROLES } as const;
export type PlayerRole = GameRole;

export const ROLE_DESCRIPTIONS: Record<PlayerRole, string> = {
  'Scrum Master': 'Người dẫn dắt team. Trong đêm đầu, bí mật biết danh tính Người trễ task. Nếu Người trễ task đoán đúng bạn cuối game, phe xấu thắng.',
  'Project Manager': 'Có quyền chiếm chỉ định nhóm Sprint (1 lần/game). Khi dùng, bỏ qua biểu quyết, đi thẳng vào thực thi.',
  'Developer': 'Lá phiếu biểu quyết quan trọng. Phải vote SUCCESS khi đi Sprint.',
  'Business Analyst': 'Kiểm tra 2 người (1 lần/game). Quản trò trả Yes nếu ≥1 thuộc phe xấu, ngược lại No.',
  'Quality Controller': 'Yêu cầu làm lại Sprint (1 lần/game). Hủy kết quả Sprint vừa công bố, lập kế hoạch lại từ đầu.',
  'Technical Leader': 'Gánh team. Nếu trong nhóm Sprint có TL và chỉ có 1 phiếu Fail, phiếu đó tự đổi thành Success.',
  'Data Analyst': 'Phân tích phiếu (1 lần/game, sau khi có kết quả Sprint). Chọn 1 người đã đi Sprint để biết phiếu thực thi của họ.',
  'Thực tập sinh': 'Đầu game chọn 1 người để theo sát. Từ Sprint 2, phiếu biểu quyết duyệt nhóm của người đó được nhân đôi.',

  'Người trễ task': 'Vote Cháy deadline khi đi Sprint. Cuối game, nếu phe tốt thắng, được 1 lần chỉ điểm Scrum Master để lật kèo.',
  'Client': 'Biết danh tính Business Analyst ngay từ đầu game. Phối hợp tống khứ hoặc đánh lạc hướng.',
  'Ông sếp khó ưa': 'Mỗi Sprint chọn 1 người, người đó bị cấm chat, voice và reaction trong thảo luận Planning.',
  'Kẻ fake CV': 'Nếu BA kiểm tra, hệ thống trả kết quả "Scrum Team" (lừa).',
  'QC cẩu thả': 'Khi đi Sprint và vote Cháy deadline, phiếu của bạn tính là 2 phiếu Fail.',
  'Deadline': 'Áp lực tối đa (1 lần/game): cấm chat của TẤT CẢ thành viên trong Planning của Sprint đó.',
  'Technical Debt': 'Nếu bạn tham gia Sprint hiện tại, Sprint tiếp theo bắt buộc cộng thêm +1 nhân sự.',
};

// Kỹ năng tách riêng khỏi flavor text: name + effect (cơ chế game) + trigger (gợi ý thời điểm).
export const ROLE_SKILLS: Record<PlayerRole, { name: string; effect: string; trigger?: string }> = {
  // === GOOD ===
  'Scrum Master': {
    name: 'Nội gián phe tốt',
    effect: 'Biết danh tính Người trễ task từ đêm đầu. Phe xấu thắng nếu Người trễ task đoán đúng bạn cuối game.',
    trigger: 'Passive — luôn biết',
  },
  'Project Manager': {
    name: 'Chiếm chỉ định nhóm',
    effect: '1 lần/game. Trước khi PO chốt nhóm, dùng skill để bỏ qua biểu quyết, đi thẳng vào thực thi Sprint.',
    trigger: 'Dùng trong Planning trước khi PO chốt nhóm',
  },
  'Developer': {
    name: 'Lá phiếu trung thành',
    effect: 'Bắt buộc vote SUCCESS khi đi Sprint. Lá phiếu quan trọng để hoàn thành sprint.',
    trigger: 'Passive — tự động khi vote Execution',
  },
  'Business Analyst': {
    name: 'Kiểm tra 2 người',
    effect: '1 lần/game. Chọn 2 người bất kỳ. Quản trò trả Yes nếu ≥1 thuộc phe xấu, No nếu cả 2 phe tốt.',
    trigger: 'Dùng trong giờ tan ca hoặc Planning',
  },
  'Quality Controller': {
    name: 'Yêu cầu làm lại Sprint',
    effect: '1 lần/game. Hủy kết quả Sprint vừa công bố, lập kế hoạch lại từ đầu (không tính sprint đã chạy).',
    trigger: 'Dùng ngay sau khi Sprint Result công bố',
  },
  'Technical Leader': {
    name: 'Gánh team',
    effect: 'Nếu trong nhóm Sprint có TL và chỉ có đúng 1 phiếu Fail, phiếu đó tự động đổi thành Success.',
    trigger: 'Passive — tự kích hoạt khi trong nhóm Sprint',
  },
  'Data Analyst': {
    name: 'Phân tích phiếu',
    effect: '1 lần/game. Chọn 1 người đã đi Sprint để biết phiếu thực thi của họ.',
    trigger: 'Trong cửa sổ 20 giây sau kết quả Sprint',
  },
  'Thực tập sinh': {
    name: 'Theo sát nhân viên',
    effect: 'Đầu game chọn 1 người để theo. Từ Sprint 2 trở đi, phiếu biểu quyết duyệt nhóm của người đó được nhân đôi.',
    trigger: 'Chọn người ngay đêm đầu tiên, hiệu lực từ Sprint 2',
  },

  // === BAD ===
  'Người trễ task': {
    name: 'Phá hoại + Lật kèo',
    effect: 'Vote Cháy deadline khi đi Sprint. Cuối game, nếu phe tốt thắng, được 1 lần chỉ điểm Scrum Master — đoán đúng → phe xấu thắng.',
    trigger: 'Active trong Execution, đặc biệt Sprint 3 (double fail) khi muốn fail',
  },
  'Client': {
    name: 'Nội gián BA',
    effect: 'Biết danh tính Business Analyst ngay từ đầu game. Phối hợp tống khử hoặc đánh lạc hướng khi BA dùng skill kiểm tra.',
    trigger: 'Passive — luôn biết BA',
  },
  'Ông sếp khó ưa': {
    name: 'Cấm thảo luận',
    effect: 'Mỗi Sprint chọn 1 người, người đó bị cấm chat, voice và reaction trong thảo luận Planning.',
    trigger: 'Dùng trong Planning',
  },
  'Kẻ fake CV': {
    name: 'Lừa BA',
    effect: 'Nếu BA kiểm tra, hệ thống trả kết quả "Scrum Team" (che giấu phe xấu).',
    trigger: 'Passive — tự kích hoạt khi bị kiểm tra',
  },
  'QC cẩu thả': {
    name: 'Nhân đôi Fail',
    effect: 'Khi đi Sprint và vote Cháy deadline, phiếu của bạn được tính là 2 phiếu Fail. Ở Sprint 3 (double fail) chỉ cần vote 1 mình bạn là fail.',
    trigger: 'Active trong Execution, đặc biệt Sprint 3',
  },
  'Deadline': {
    name: 'Cấm chat toàn team',
    effect: '1 lần/game. Cấm chat của TẤT CẢ thành viên trong vòng Planning của Sprint đó.',
    trigger: 'Dùng trong thảo luận Planning',
  },
  'Technical Debt': {
    name: '+1 nhân sự Sprint sau',
    effect: 'Nếu bạn tham gia Sprint hiện tại, Sprint tiếp theo bắt buộc cộng thêm +1 nhân sự (tăng khả năng lọt phe xấu vào team).',
    trigger: 'Passive — tự kích hoạt khi tham gia Sprint',
  },
};

export interface RoleConfig {
  counts: Partial<Record<PlayerRole, number>>;
}

export function isGoodRole(role: string): boolean {
  return (GOOD_ROLES as readonly string[]).includes(role);
}
