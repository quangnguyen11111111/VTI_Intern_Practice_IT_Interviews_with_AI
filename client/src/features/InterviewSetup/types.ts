import type { UseFormReturn } from "react-hook-form";
import type { BaseEntity } from "../../services/api/interviewApi";

export const SetupMode = {
  MANUAL: 'MANUAL',
  JD_UPLOAD: 'JD_UPLOAD',
} as const;

export type SetupMode = typeof SetupMode[keyof typeof SetupMode];

export interface ManualSetupFormData {
  jobPosition: string; // Will store role _id
  level: string; // Will store level _id
  techStacks: string[]; // Will store technology _ids
}

export interface JDUploadFormData {
  jdFile: FileList | null;
}

export interface UseInterviewSetupReturn {
  manualForm: UseFormReturn<ManualSetupFormData>;
  jdForm: UseFormReturn<JDUploadFormData>;
  activeMode: SetupMode;
  setActiveMode: (mode: SetupMode) => void;
  isLoading: boolean;
  isFetchingData: boolean;
  error: string | null;
  successMessage: string | null;
  sessionId: string | null;
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
  onSubmitManual: (data: ManualSetupFormData) => void;
  onSubmitJd: (data: JDUploadFormData) => void;
}
