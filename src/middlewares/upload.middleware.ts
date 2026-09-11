import multer from 'multer';
import { AppError } from '../utils/AppError';
import { extname } from 'node:path';

// Use memory storage so we don't save files to disk
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
    fields: 3,
    parts: 4,
    fieldSize: 4096,
  },
  fileFilter: (req, file, cb) => {
    const types: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    if (types[extname(file.originalname).toLowerCase()] === file.mimetype) {
      cb(null, true);
    } else {
      cb(new AppError('Only PDF and DOCX files are allowed.', 415, 'UNSUPPORTED_FILE_TYPE'));
    }
  },
});
