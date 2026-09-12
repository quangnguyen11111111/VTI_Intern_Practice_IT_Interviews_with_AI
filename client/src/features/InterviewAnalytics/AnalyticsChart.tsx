import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { InterviewAnalyticsSeriesPoint } from '../../services/api/interviewApi';

const DIMENSIONS = [
  'Technical Depth',
  'Problem Solving',
  'System Design & Best Practices',
  'Communication',
  'Practical Experience'
] as const;

const labels: Record<string, string> = {
  overall: 'Tổng thể',
  'Technical Depth': 'Chuyên môn',
  'Problem Solving': 'Giải quyết vấn đề',
  'System Design & Best Practices': 'Thiết kế hệ thống',
  Communication: 'Giao tiếp',
  'Practical Experience': 'Thực chiến'
};

interface Props {
  series: InterviewAnalyticsSeriesPoint[];
}

export const AnalyticsChart = ({ series }: Props) => {
  const chartData = useMemo(
    () =>
      series.map((point) => {
        const dimensions = Object.fromEntries(
          point.dimensions.map((dimension) => [
            dimension.name,
            dimension.score
          ])
        );

        return {
          date: point.date,
          overall: point.overallScore,
          ...dimensions
        };
      }),
    [series]
  );

  return (
    <div
      className="w-full"
      aria-label="Biểu đồ xu hướng điểm phỏng vấn theo thời gian"
    >
      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 12,
              left: 0,
              bottom: 8
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
            />

            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              formatter={(
                value: number | null,
                name: string
              ) => [
                value == null ? '—' : `${value} / 10`,
                labels[name] ?? name
              ]}
            />

            <Legend
              formatter={(value) => labels[value] ?? value}
            />

            <Line
              type="monotone"
              dataKey="overall"
              name="overall"
              stroke="#4f46e5"
              strokeWidth={3}
              dot={{ r: 3 }}
            />

            {DIMENSIONS.map((name, index) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                name={name}
                stroke={
                  [
                    '#7c3aed',
                    '#059669',
                    '#d97706',
                    '#dc2626',
                    '#0891b2'
                  ][index]
                }
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>
          Dữ liệu xu hướng điểm theo ngày
        </caption>

        <thead>
          <tr>
            <th>Ngày</th>
            <th>Tổng thể</th>

            {DIMENSIONS.map((name) => (
              <th key={name}>{labels[name]}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {series.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.overallScore}</td>

              {DIMENSIONS.map((name) => (
                <td key={name}>
                  {point.dimensions.find(
                    (dimension) => dimension.name === name
                  )?.score ?? 'Không có dữ liệu'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
