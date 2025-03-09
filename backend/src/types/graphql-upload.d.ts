declare module 'graphql-upload' {
  import { Request, Response, NextFunction } from 'express';
  import { Stream } from 'stream';

  export interface FileUpload {
    filename: string;
    mimetype: string;
    encoding: string;
    createReadStream: () => Stream;
  }

  export function graphqlUploadExpress(options?: {
    maxFieldSize?: number;
    maxFileSize?: number;
    maxFiles?: number;
  }): (req: Request, res: Response, next: NextFunction) => void;

  export interface Upload {
    promise: Promise<FileUpload>;
    file?: FileUpload;
  }
} 