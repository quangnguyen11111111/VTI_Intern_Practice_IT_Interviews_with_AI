import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { InterviewRoom } from '../features/InterviewRoom/InterviewRoom';

export const InterviewRoomPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  if (!sessionId) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <div className="bg-slate-50">
      <InterviewRoom />
    </div>
  );
};
