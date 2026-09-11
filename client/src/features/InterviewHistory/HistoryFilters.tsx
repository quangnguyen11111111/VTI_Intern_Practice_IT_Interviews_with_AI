import type { BaseEntity, InterviewHistoryStatus } from '../../services/api/interviewApi';
import type { HistoryFilters as HistoryFilterState } from './types';

interface Props {
  filters: HistoryFilterState;
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
  onChange: (patch: Partial<HistoryFilterState>) => void;
}

const statuses: Array<{ value: InterviewHistoryStatus; label: string }> = [
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'GENERATING', label: 'Đang tạo câu hỏi' },
  { value: 'IN_PROGRESS', label: 'Đang phỏng vấn' },
  { value: 'EVALUATING', label: 'Đang đánh giá' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'FAILED', label: 'Thất bại' },
];

const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

export const HistoryFilters = ({ filters, roles, levels, technologies, onChange }: Props) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    <div>
      <label htmlFor="history-role" className="mb-2 block text-sm font-semibold text-slate-700">Vai trò phỏng vấn</label>
      <select id="history-role" value={filters.role} onChange={(e) => onChange({ role: e.target.value })} className={selectClass}>
        <option value="">Tất cả vai trò</option>
        {roles.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor="history-level" className="mb-2 block text-sm font-semibold text-slate-700">Cấp độ</label>
      <select id="history-level" value={filters.level} onChange={(e) => onChange({ level: e.target.value })} className={selectClass}>
        <option value="">Tất cả cấp độ</option>
        {levels.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor="history-technology" className="mb-2 block text-sm font-semibold text-slate-700">Công nghệ</label>
      <select id="history-technology" value={filters.technology} onChange={(e) => onChange({ technology: e.target.value })} className={selectClass}>
        <option value="">Tất cả công nghệ</option>
        {technologies.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor="history-status" className="mb-2 block text-sm font-semibold text-slate-700">Trạng thái</label>
      <select id="history-status" value={filters.status} onChange={(e) => onChange({ status: e.target.value as InterviewHistoryStatus | '' })} className={selectClass}>
        <option value="">Tất cả trạng thái</option>
        {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor="history-from" className="mb-2 block text-sm font-semibold text-slate-700">Từ ngày</label>
      <input id="history-from" type="date" value={filters.from} onChange={(e) => onChange({ from: e.target.value })} className={selectClass} />
    </div>
    <div>
      <label htmlFor="history-to" className="mb-2 block text-sm font-semibold text-slate-700">Đến ngày</label>
      <input id="history-to" type="date" value={filters.to} onChange={(e) => onChange({ to: e.target.value })} className={selectClass} />
    </div>
    <div>
      <label htmlFor="history-sort" className="mb-2 block text-sm font-semibold text-slate-700">Sắp xếp</label>
      <select id="history-sort" value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as HistoryFilterState['sort'] })} className={selectClass}>
        <option value="newest">Mới nhất trước</option>
        <option value="oldest">Cũ nhất trước</option>
      </select>
    </div>
    <div>
      <label htmlFor="history-limit" className="mb-2 block text-sm font-semibold text-slate-700">Số mục mỗi trang</label>
      <select id="history-limit" value={filters.limit} onChange={(e) => onChange({ limit: Number(e.target.value) })} className={selectClass}>
        {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value} mục</option>)}
      </select>
    </div>
  </div>
);
