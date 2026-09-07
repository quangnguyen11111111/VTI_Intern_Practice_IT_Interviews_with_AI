import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { InterviewSession } from '../../InterviewRoom/types';

interface Props {
  dimensions: NonNullable<InterviewSession['dimensions']>;
  language: 'vi' | 'en';
}

export const RadarScoreChart: React.FC<Props> = ({ dimensions, language }) => {
  const chartData = useMemo(() => {
    const translations: Record<string, string> = {
      "Technical Depth": "Chuyên môn",
      "Problem Solving": "Giải quyết vấn đề",
      "System Design & Best Practices": "Thiết kế Hệ thống",
      "Communication": "Giao tiếp",
      "Practical Experience": "Thực chiến"
    };

    return dimensions.map(d => ({
      subject: language === 'vi' ? (translations[d.name] || d.name) : d.name,
      score: d.score,
      fullMark: 10,
    }));
  }, [dimensions, language]);

  if (chartData.length === 0) {
    return <div className="text-slate-500 text-center py-8">Chưa có dữ liệu đánh giá</div>;
  }

  return (
    <div className="w-full h-72 md:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 13, fontWeight: 500 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} />
          <Tooltip 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`${value} / 10`, 'Điểm trung bình']} 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Radar
            name="Ứng viên"
            dataKey="score"
            stroke="#6366f1"
            fill="#818cf8"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
