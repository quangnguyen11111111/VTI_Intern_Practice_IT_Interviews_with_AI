import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { InterviewSetupPage } from './pages/InterviewSetupPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthBootstrap } from './auth/AuthBootstrap';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthBootstrap>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['CANDIDATE', 'INTERVIEWER']} />}>
            <Route path="/setup" element={<InterviewSetupPage />} />
          </Route>
        </Routes>
      </AuthBootstrap>
    </Router>
  );
}

export default App;
