import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Trash2, ExternalLink, File, Image, FileSpreadsheet, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentsApi } from '../services/api';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  google_drive_url: string;
  uploaded_by_name: string;
  created_at: string;
}

interface DocumentManagerProps {
  entityType: string;
  entityId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return <Image className="w-5 h-5 text-purple-500" />;
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  if (mimeType?.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-blue-500" />;
}

export default function DocumentManager({ entityType, entityId }: DocumentManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: () => documentsApi.getByEntity(entityType, entityId).then((res) => res.data),
  });

  const documents: Document[] = data?.documents ?? [];

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);
      return documentsApi.upload(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
      toast.success('מסמך הועלה בהצלחה');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'שגיאה בהעלאת מסמך');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
      toast.success('מסמך נמחק');
    },
    onError: () => toast.error('שגיאה במחיקת מסמך'),
  });

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast.error('הקובץ גדול מדי (מקסימום 10MB)');
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer ${
          isDragging
            ? 'border-primary-500 bg-primary-50 shadow-inner'
            : 'border-primary-200 hover:border-primary-400 hover:bg-primary-50/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploadMutation.isPending ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="text-primary-600 font-medium font-heading">מעלה...</span>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6 text-primary-500" />
            </div>
            <p className="text-sm text-gray-600 font-medium">גרור קובץ לכאן או לחץ לבחירה</p>
            <p className="text-xs text-gray-400 mt-1">מקסימום 10MB</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent mx-auto"></div>
        </div>
      ) : documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="card flex items-center justify-between p-3 hover:shadow-card-hover transition-all duration-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0">
                  {getFileIcon(doc.file_type)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium font-heading text-gray-900 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(doc.file_size)} • {doc.uploaded_by_name || 'מערכת'} • {new Date(doc.created_at).toLocaleDateString('he-IL')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {doc.google_drive_url && (
                  <a
                    href={doc.google_drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-icon text-primary-600 hover:text-primary-700"
                    title="פתח ב-Google Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => {
                    if (confirm('האם למחוק מסמך זה?')) {
                      deleteMutation.mutate(doc.id);
                    }
                  }}
                  className="btn-icon text-red-400 hover:text-red-600"
                  title="מחק מסמך"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-400 text-sm py-4">אין מסמכים</p>
      )}
    </div>
  );
}
