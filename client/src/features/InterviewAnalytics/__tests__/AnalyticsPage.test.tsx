import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPage } from '../../../pages/AnalyticsPage';
import { interviewApi } from '../../../services/api/interviewApi';

vi.mock('../../../services/api/interviewApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/api/interviewApi')>('../../../services/api/interviewApi');
  return {
    ...actual,
    interviewApi: {
      ...actual.interviewApi,
      getAnalytics: vi.fn(),
      fetchRoles: vi.fn(),
      fetchLevels: vi.fn(),
      fetchTechnologies: vi.fn(),
    }
  };
});

const analytics = {
  summary: {
    totalCompleted: 2,
    averageOverallScore: 8,
    dimensions: [
      { name: 'Technical Depth', score: 8 },
      { name: 'Problem Solving', score: 7 },
      { name: 'System Design & Best Practices', score: 9 },
      { name: 'Communication', score: 8 },
      { name: 'Practical Experience', score: 8 }
    ]
  },
  series: [{
    date: '2026-09-01',
    overallScore: 8,
    dimensions: [
      { name: 'Technical Depth', score: 8 },
      { name: 'Problem Solving', score: 7 },
      { name: 'System Design & Best Practices', score: 9 },
      { name: 'Communication', score: 8 },
      { name: 'Practical Experience', score: 8 }
    ]
  }]
};

const renderPage = (entry = '/analytics') => render(
  <MemoryRouter initialEntries={[entry]}>
    <AnalyticsPage />
  </MemoryRouter>
);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(interviewApi.fetchRoles).mockResolvedValue([{ _id: 'role-1', code: 'BE', name: 'Backend Developer' }]);
  vi.mocked(interviewApi.fetchLevels).mockResolvedValue([{ _id: 'level-1', code: 'JUNIOR', name: 'Junior' }]);
  vi.mocked(interviewApi.fetchTechnologies).mockResolvedValue([{ _id: 'tech-1', code: 'NODE', name: 'Node.js' }]);
  vi.mocked(interviewApi.getAnalytics).mockResolvedValue(analytics);
});

describe('ANA-01 AnalyticsPage', () => {
  it('renders loading then real analytics data and textual chart data', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu phân tích');
    expect(await screen.findByText('Tiến bộ phỏng vấn')).toBeInTheDocument();
    expect(screen.getByText('Phiên hoàn thành')).toBeInTheDocument();
    expect(screen.getAllByText('8.00 / 10')).not.toHaveLength(0);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('2026-09-01')).toBeInTheDocument();
  });

  it('restores URL filters and sends them to the API', async () => {
    renderPage('/analytics?role=role-1&level=level-1&technology=tech-1&from=2026-09-01&to=2026-09-10');
    await screen.findByText('Tiến bộ phỏng vấn');
    await waitFor(() => expect(interviewApi.getAnalytics).toHaveBeenCalledWith({
      role: 'role-1', level: 'level-1', technology: 'tech-1', from: '2026-09-01', to: '2026-09-10'
    }));
    expect(screen.getByLabelText('Lọc theo vai trò')).toHaveValue('role-1');
    expect(screen.getByLabelText('Ngày bắt đầu')).toHaveValue('2026-09-01');
  });

  it('updates the URL-backed filter state', async () => {
    renderPage();
    await screen.findByText('Tiến bộ phỏng vấn');
    fireEvent.change(screen.getByLabelText('Lọc theo vai trò'), { target: { value: 'role-1' } });
    await waitFor(() => expect(interviewApi.getAnalytics).toHaveBeenLastCalledWith({ role: 'role-1' }));
  });

  it('shows empty guidance', async () => {
    vi.mocked(interviewApi.getAnalytics).mockResolvedValue({
      summary: { totalCompleted: 0, averageOverallScore: null, dimensions: analytics.summary.dimensions.map((d) => ({ ...d, score: null })) },
      series: []
    });
    renderPage();
    expect(await screen.findByText('Chưa có dữ liệu xu hướng')).toBeInTheDocument();
  });

  it('shows error and retries the real API', async () => {
    vi.mocked(interviewApi.getAnalytics).mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(analytics);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(interviewApi.getAnalytics).toHaveBeenCalledTimes(2));
  });
});