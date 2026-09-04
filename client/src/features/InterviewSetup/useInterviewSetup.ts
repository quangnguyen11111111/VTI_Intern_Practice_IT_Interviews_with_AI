/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { interviewApi, type BaseEntity } from '../../services/api/interviewApi';
import { SetupMode, type ManualSetupFormData, type JDUploadFormData, type UseInterviewSetupReturn } from './types';
import { useAuthStore } from '../../auth/authStore';

export const useInterviewSetup = (): UseInterviewSetupReturn => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<SetupMode>(SetupMode.MANUAL);
  const { user } = useAuthStore();

  const manualForm = useForm<ManualSetupFormData>({
    defaultValues: {
      jobPosition: '',
      level: '',
      techStacks: [],
    }
  });

  const jdForm = useForm<JDUploadFormData>({
    defaultValues: {
      jdFile: null,
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
  // eslint-disable-next-line react-hooks/incompatible-library
  const jobPosition = manualForm.watch('jobPosition');

  useEffect(() => {
    const fetchTechsByRole = async () => {
      if (!jobPosition) {
        setTechnologies([]);
        manualForm.setValue('techStacks', []);
        return;
      }
      
      try {
        const fetchedTechs = await interviewApi.fetchTechnologies(jobPosition);
        setTechnologies(fetchedTechs);
        // Clear selected tech stacks that are no longer in the new list
        const currentTechs = manualForm.getValues('techStacks');
        const validTechIds = fetchedTechs.map(t => t._id);
        const newTechs = currentTechs.filter(id => validTechIds.includes(id));
        manualForm.setValue('techStacks', newTechs);
      } catch (err) {
        console.error('Lỗi khi lấy công nghệ:', err);
      }
    };

    fetchTechsByRole();
  }, [jobPosition, manualForm]);

  const onSubmitManual = async (data: ManualSetupFormData) => {
    // Validate manually for techStacks since it's a custom field
    if (data.techStacks.length === 0) {
      setError('Vui lòng chọn ít nhất một công nghệ (Tech Stack).');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = { ...data, userId: user?.id };
      const session = await interviewApi.setupInterview(payload);
      
      const id = (session as any)._id || (session as any).id;
      if (id) {
        navigate(`/interview/${id}`);
      } else {
        throw new Error("Không lấy được ID phiên phỏng vấn.");
      }
    } catch (err) {
      console.error('Lỗi thiết lập phỏng vấn:', err);
      setError('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitJd = async (data: JDUploadFormData) => {
    if (!data.jdFile || data.jdFile.length === 0) {
      setError('Vui lòng chọn file Job Description (JD).');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create FormData to upload file
      const formData = new FormData();
      formData.append('jdFile', data.jdFile[0]);
      if (user?.id) {
        formData.append('userId', user.id);
      }

      const session = await interviewApi.uploadJdInterview(formData);
      
      const id = (session as any)._id || (session as any).id;
      if (id) {
        navigate(`/interview/${id}`);
      } else {
        throw new Error("Không lấy được ID phiên phỏng vấn.");
      }
    } catch (err) {
      console.error('Lỗi tải lên JD:', err);
      setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra trong quá trình tải lên JD.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    manualForm,
    jdForm,
    activeMode,
    setActiveMode,
    isLoading,
    isFetchingData,
    error,
    roles,
    levels,
    technologies,
    onSubmitManual,
    onSubmitJd,
  };
};

