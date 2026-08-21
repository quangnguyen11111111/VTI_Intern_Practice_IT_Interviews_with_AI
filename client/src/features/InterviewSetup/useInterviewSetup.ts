import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { interviewApi, type BaseEntity } from '../../services/api/interviewApi';
import { type InterviewSetupFormData, type UseInterviewSetupReturn } from './types';

export const useInterviewSetup = (): UseInterviewSetupReturn => {
  const form = useForm<InterviewSetupFormData>({
    defaultValues: {
      jobPosition: '',
      level: '',
      techStacks: [],
    }
  });

  // States for dynamic data
  const [roles, setRoles] = useState<BaseEntity[]>([]);
  const [levels, setLevels] = useState<BaseEntity[]>([]);
  const [technologies, setTechnologies] = useState<BaseEntity[]>([]);
  const [isFetchingData, setIsFetchingData] = useState<boolean>(true);

  // States for form submission
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch initial data (Roles & Levels)
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsFetchingData(true);
      try {
        const [fetchedRoles, fetchedLevels] = await Promise.all([
          interviewApi.fetchRoles(),
          interviewApi.fetchLevels(),
        ]);
        setRoles(fetchedRoles);
        setLevels(fetchedLevels);
      } catch (err) {
        console.error('Lỗi khi lấy dữ liệu cấu hình:', err);
        setError('Không thể lấy dữ liệu cấu hình. Vui lòng tải lại trang.');
      } finally {
        setIsFetchingData(false);
      }
    };

    fetchInitialData();
  }, []);

  // Watch jobPosition to fetch related technologies
  const jobPosition = form.watch('jobPosition');

  useEffect(() => {
    const fetchTechsByRole = async () => {
      if (!jobPosition) {
        setTechnologies([]);
        form.setValue('techStacks', []);
        return;
      }
      
      try {
        const fetchedTechs = await interviewApi.fetchTechnologies(jobPosition);
        setTechnologies(fetchedTechs);
        // Clear selected tech stacks that are no longer in the new list
        const currentTechs = form.getValues('techStacks');
        const validTechIds = fetchedTechs.map(t => t._id);
        const newTechs = currentTechs.filter(id => validTechIds.includes(id));
        form.setValue('techStacks', newTechs);
      } catch (err) {
        console.error('Lỗi khi lấy công nghệ:', err);
      }
    };

    fetchTechsByRole();
  }, [jobPosition, form]);

  const onSubmit = async (data: InterviewSetupFormData) => {
    // Validate manually for techStacks since it's a custom field
    if (data.techStacks.length === 0) {
      setError('Vui lòng chọn ít nhất một công nghệ (Tech Stack).');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await interviewApi.setupInterview(data);
      
      setSuccessMessage('Thiết lập phỏng vấn thành công!');
      form.reset();
    } catch (err) {
      console.error('Lỗi thiết lập phỏng vấn:', err);
      setError('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    isFetchingData,
    error,
    successMessage,
    roles,
    levels,
    technologies,
    onSubmit,
  };
};
