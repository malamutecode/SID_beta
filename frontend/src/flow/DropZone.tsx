// A drag-and-drop file area that extracts document text via the backend.
// On a successful drop it reports the extracted text + file name upward.

import { useRef, useState } from 'react';
import { classifyService } from '../services/classifyService';

interface Props {
  // Called with the extracted text and the original file name.
  onExtracted: (text: string, name: string) => void;
  // Current loaded file name (so the zone can show what's loaded).
  fileName: string | null;
  onError: (msg: string) => void;
}

const ACCEPT = '.pdf,.docx,.png,.jpg,.jpeg';

export function DropZone({ onExtracted, fileName, onError }: Props) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    onError('');
    try {
      const res = await classifyService.extract(file);
      onExtracted(res.text, res.document_name);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`dropzone${dragging ? ' dragging' : ''}${busy ? ' busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {busy ? (
        <div className="dz-text">Wczytywanie…</div>
      ) : fileName ? (
        <>
          <div className="dz-icon">📄</div>
          <div className="dz-text"><b>{fileName}</b></div>
          <div className="dz-hint">Upuść inny plik lub kliknij, aby zmienić</div>
        </>
      ) : (
        <>
          <div className="dz-icon">⬆️</div>
          <div className="dz-text">Przeciągnij i upuść dokument</div>
          <div className="dz-hint">lub kliknij, aby wybrać · PDF, DOCX, PNG, JPG</div>
        </>
      )}
    </div>
  );
}
