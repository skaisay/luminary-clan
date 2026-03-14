import multer from "multer";
import path from "path";
import { nanoid } from "nanoid";

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, "uploads/videos");
  },
  filename: function (_req, file, cb) {
    const uniqueId = nanoid(10);
    const ext = path.extname(file.originalname);
    cb(null, `video_${Date.now()}_${uniqueId}${ext}`);
  },
});

const fileFilter = (_req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/x-matroska",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only video files are allowed."), false);
  }
};

export const videoUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB max file size - поддержка очень больших видео без потери качества
  },
});
