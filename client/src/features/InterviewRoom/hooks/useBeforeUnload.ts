import { useEffect } from 'react';

export const useBeforeUnload = (shouldWarn: boolean = true) => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!shouldWarn) return;
      e.preventDefault();
      // Most modern browsers ignore the custom string and display a standard warning
      e.returnValue = 'Bạn có chắc chắn muốn rời đi? Dữ liệu đang nhập có thể bị mất.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldWarn]);
};
