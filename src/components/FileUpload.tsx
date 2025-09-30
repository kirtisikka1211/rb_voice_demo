import React, { useRef, useState } from 'react';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // MB
  onFilesSelected?: (files: FileList) => void;
  label?: string;
  description?: string;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  multiple = false,
  maxSize = 10,
  onFilesSelected,
  label = 'Upload Files',
  description = 'Drag and drop files here or click to browse',
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleFileSelect = (fileList: FileList) => {
    const files = Array.from(fileList);
    const valid = files.filter(f => (f.size / (1024 * 1024)) <= maxSize);
    if (!multiple && valid.length > 1) {
      const dt = new DataTransfer();
      dt.items.add(valid[0]);
      onFilesSelected?.(dt.files);
    } else {
      const dt = new DataTransfer();
      valid.forEach(f => dt.items.add(f));
      onFilesSelected?.(dt.files);
    }
  };

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (e.target.files) handleFileSelect(e.target.files);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragOver ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
        onClick={openPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        data-testid="file-upload-area"
      >
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-1">{description}</div>}
        <div className="text-[11px] text-gray-500 mt-2">Max size: {maxSize}MB{accept ? ` • Types: ${accept}` : ''}</div>
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={onChange} />
      </div>
    </div>
  );
};

export default FileUpload;


