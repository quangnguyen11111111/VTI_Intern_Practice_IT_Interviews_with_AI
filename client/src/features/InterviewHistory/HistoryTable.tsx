import type { InterviewHistoryItem, InterviewHistoryStatus } from '../../services/api/interviewApi';

interface Props {
  items: InterviewHistoryItem[];
  roleNames: Map<string, string>;
  levelNames: Map<string, string>;
  technologyNames: Map<string, string>;
  onOpen: (item: InterviewHistoryItem) => void;
}

const statusLabels: Record<InterviewHistoryStatus, string> = {
  PENDING: 'Chờ xử lý',
  GENERATING: 'Đang tạo câu hỏi',
  IN_PROGRESS: 'Đang phỏng vấn',
  EVALUATING: 'Đang đánh giá',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Thất bại',
};

const statusClasses: Record<InterviewHistoryStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  GENERATING: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  EVALUATING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
};

const displayName = (id: string | undefined, map: Map<string, string>) => id ? map.get(id) ?? 'Không xác định' : '—';
const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export const HistoryTable = ({ items, roleNames, levelNames, technologyNames, onOpen }: Props) => (
  <div className="overflow-x-auto">
    <table className="min-w-[920px] w-full text-left">
      <caption className="sr-only">Lịch sử các phiên phỏng vấn</caption>
      <thead className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
        <tr>
          <th scope="col" className="px-4 py-4">Vai trò</th>
          <th scope="col" className="px-4 py-4">Cấp độ</th>
          <th scope="col" className="px-4 py-4">Công nghệ</th>
          <th scope="col" className="px-4 py-4">Điểm</th>
          <th scope="col" className="px-4 py-4">Trạng thái</th>
          <th scope="col" className="px-4 py-4">Thời gian</th>
          <th scope="col" className="px-4 py-4 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map((item) => {
          const actionLabel = item.status === 'COMPLETED' ? 'Xem kết quả' : item.status === 'FAILED' ? 'Không khả dụng' : 'Mở phiên';
          return (
            <tr key={item.sessionId} className="align-top transition hover:bg-slate-50">
              <td className="px-4 py-4 font-semibold text-slate-900">{displayName(item.role, roleNames)}</td>
              <td className="px-4 py-4 text-slate-700">{displayName(item.level, levelNames)}</td>
              <td className="max-w-xs px-4 py-4 text-slate-700">
                <div className="flex flex-wrap gap-1.5">
                  {item.technologies.length ? item.technologies.map((id) => (
                    <span key={id} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{technologyNames.get(id) ?? 'Không xác định'}</span>
                  )) : <span>—</span>}
                </div>
              </td>
              <td className="px-4 py-4 font-bold text-slate-900">{item.score === null ? '—' : `${item.score.toFixed(1)}/10`}</td>
              <td className="px-4 py-4">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClasses[item.status]}`}>
                  {statusLabels[item.status]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{formatDate(item.createdAt)}</td>
              <td className="px-4 py-4 text-right">
                <button type="button" disabled={item.status === 'FAILED'} onClick={() => onOpen(item)} className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">
                  {actionLabel}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
