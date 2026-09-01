import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';

import { HomePage } from './pages/HomePage';
import { InterviewSetupPage } from './pages/InterviewSetupPage';
import { InterviewRoomPage } from './pages/InterviewRoomPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { AuthBootstrap } from './auth/AuthBootstrap';
import {
  GuestRoute,
  ProtectedRoute
} from './auth/ProtectedRoute';

import { AdminUsersPage } from './pages/AdminUsersPage';

function App() {
  return (
    <Router>
      <AuthBootstrap>
        <Routes>
          <Route
            path="/"
            element={<HomePage />}
          />

          <Route element={<GuestRoute />}>
            <Route
              path="/login"
              element={<LoginPage />}
            />

            <Route
              path="/register"
              element={<RegisterPage />}
            />

            <Route
              path="/forgot-password"
              element={<ForgotPasswordPage />}
            />

            <Route
              path="/reset-password"
              element={<ResetPasswordPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  'CANDIDATE',
                  'INTERVIEWER',
                  'ADMIN'
                ]}
              />
            }
          >
            <Route
              path="/profile"
              element={<ProfilePage />}
            />

            <Route
              path="/change-password"
              element={<ChangePasswordPage />}
            />

            <Route
              path="/admin/users"
              element={<AdminUsersPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  'CANDIDATE',
                  'INTERVIEWER'
                ]}
              />
            }
          >
            <Route
              path="/setup"
              element={<InterviewSetupPage />}
            />

            <Route
              path="/interview/:sessionId"
              element={<InterviewRoomPage />}
            />
          </Route>
        </Routes>
      </AuthBootstrap>
    </Router>
  );
}

export default App;