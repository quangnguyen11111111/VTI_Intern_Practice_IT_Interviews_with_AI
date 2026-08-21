import type { UseFormReturn } from "react-hook-form";
import type { BaseEntity } from "../../services/api/interviewApi";


export interface InterviewSetupFormData {
  jobPosition: string; // Will store role _id
  level: string; // Will store level _id
  techStacks: string[]; // Will store technology _ids
}

export interface UseInterviewSetupReturn {
  form: UseFormReturn<InterviewSetupFormData>;
  isLoading: boolean;
  isFetchingData: boolean;
  error: string | null;
  successMessage: string | null;
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
  onSubmit: (data: InterviewSetupFormData) => void;
}
