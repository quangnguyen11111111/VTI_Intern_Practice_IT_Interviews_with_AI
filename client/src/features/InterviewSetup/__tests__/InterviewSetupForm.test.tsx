import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterviewSetupForm } from '../InterviewSetupForm';
import { interviewApi } from '../../../services/api/interviewApi';

// Mock the API calls
vi.mock('../../../services/api/interviewApi', () => ({
  interviewApi: {
    fetchRoles: vi.fn(),
    fetchLevels: vi.fn(),
    fetchTechnologies: vi.fn(),
    setupInterview: vi.fn().mockResolvedValue({ _id: 'mock-session-id' }),
    uploadJdInterview: vi.fn().mockResolvedValue({ _id: 'mock-session-id' }),
  }
}));

const mockRoles = [
  { _id: 'r1', code: 'FE', name: 'Frontend Developer' },
  { _id: 'r2', code: 'BE', name: 'Backend Developer' },
];

const mockLevels = [
  { _id: 'l1', code: 'JUNIOR', name: 'Junior' },
  { _id: 'l2', code: 'SENIOR', name: 'Senior' },
];

const mockTechnologies = [
  { _id: 't1', code: 'REACT', name: 'React' },
  { _id: 't2', code: 'NODE', name: 'Node.js' },
];

describe('InterviewSetupForm', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    
    // Default mocks to resolve with data
    vi.mocked(interviewApi.fetchRoles).mockResolvedValue(mockRoles);
    vi.mocked(interviewApi.fetchLevels).mockResolvedValue(mockLevels);
    vi.mocked(interviewApi.fetchTechnologies).mockResolvedValue(mockTechnologies);
    vi.mocked(interviewApi.setupInterview).mockResolvedValue({ _id: 'mock-session-id' });
    vi.mocked(interviewApi.uploadJdInterview).mockResolvedValue({ _id: 'mock-session-id' });
  });

  it('renders loading state initially and then displays the manual setup tab by default', async () => {
    render(<InterviewSetupForm />);
    
    // Initially shows loading state
    expect(screen.getByText('Đang tải cấu hình hệ thống...')).toBeInTheDocument();
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });
    
    // Should display Tabs
    expect(screen.getByRole('button', { name: /Tùy Chỉnh Thủ Công/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải Lên JD/i })).toBeInTheDocument();
    
    // Manual setup should be visible by default
    expect(screen.getByText('Chức danh ứng tuyển')).toBeInTheDocument();
    expect(screen.getByText('Trình độ chuyên môn')).toBeInTheDocument();
    
    // Assert API calls
    expect(interviewApi.fetchRoles).toHaveBeenCalledTimes(1);
    expect(interviewApi.fetchLevels).toHaveBeenCalledTimes(1);
  });

  it('switches to JD Upload tab when clicking the tab button', async () => {
    const user = userEvent.setup();
    render(<InterviewSetupForm />);
    
    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });
    
    // Click JD Upload tab
    const jdTabButton = screen.getByRole('button', { name: /Tải Lên JD/i });
    await user.click(jdTabButton);
    
    // Verify JD Upload UI is visible
    expect(screen.getByText('Upload Job Description (JD)')).toBeInTheDocument();
    expect(screen.getByText(/Click để tải lên/i)).toBeInTheDocument();
    
    // The Manual setup UI should not be in the document
    expect(screen.queryByText('Chức danh ứng tuyển')).not.toBeInTheDocument();
  });

  it('validates manual setup form fields', async () => {
    const user = userEvent.setup();
    render(<InterviewSetupForm />);
    
    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Bắt Đầu Phỏng Vấn Ngay/i });
    await user.click(submitBtn);

    // Form errors should appear for required fields
    expect(await screen.findByText('Vui lòng chọn chức danh')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng chọn cấp độ')).toBeInTheDocument();

    // Now fill the required fields to trigger the custom tech stack validation
    await user.selectOptions(screen.getByLabelText(/Chức danh ứng tuyển/i), 'r1');
    await user.click(screen.getByLabelText('Junior'));
    
    await user.click(submitBtn);
    
    // Custom tech stack validation error should appear
    expect(await screen.findByText('Vui lòng chọn ít nhất một công nghệ (Tech Stack).')).toBeInTheDocument();
  });

  it('handles JD Upload file selection and submission', async () => {
    const user = userEvent.setup();
    render(<InterviewSetupForm />);
    
    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });
    
    // Go to JD Upload tab
    await user.click(screen.getByRole('button', { name: /Tải Lên JD/i }));
    
    // The input should be present (hidden)
    const fileInput = document.getElementById('jdFile') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    
    // Submit button should be disabled initially
    const submitBtn = screen.getByRole('button', { name: /Phân Tích JD & Bắt Đầu Phỏng Vấn/i });
    expect(submitBtn).toBeDisabled();
    
    // Create a mock file
    const file = new File(['mock content'], 'job-description.pdf', { type: 'application/pdf' });
    
    // Upload file
    await user.upload(fileInput, file);
    
    // Assert UI updates
    expect(await screen.findByText(/Đã chọn file: job-description.pdf/i)).toBeInTheDocument();
    
    // Submit button should be enabled
    expect(submitBtn).not.toBeDisabled();
    
    // Submit the form
    await user.click(submitBtn);
    
    // Assert API call
    expect(interviewApi.uploadJdInterview).toHaveBeenCalledTimes(1);
    // Extract formData argument and assert
    const formDataArg = vi.mocked(interviewApi.uploadJdInterview).mock.calls[0][0];
    expect(formDataArg instanceof FormData).toBe(true);
    expect(formDataArg.get('jdFile')).toBe(file);
    
    // Assert success message appears
    expect(await screen.findByText(/Tải lên JD thành công/i)).toBeInTheDocument();
  });
});
