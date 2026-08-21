import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { InterviewSetupPage } from './pages/InterviewSetupPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/setup" element={<InterviewSetupPage />} />
      </Routes>
    </Router>
  );
}

export default App;