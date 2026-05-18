"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

export function NoticePdfUploadField() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  function openFileDialog() {
    inputRef.current?.click();
  }

  function clearFile() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setFileName("");
  }

  return (
    <div className="notice-pdf-upload">
      <input
        accept="application/pdf,.pdf"
        className="notice-pdf-upload__input"
        name="noticeAttachment"
        onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
        ref={inputRef}
        type="file"
      />
      <button
        className="notice-pdf-upload__button"
        onClick={openFileDialog}
        type="button"
      >
        <Paperclip aria-hidden="true" size={16} />
        Attach PDF
      </button>
      {fileName ? (
        <span className="notice-pdf-upload__chip">
          {fileName}
          <button aria-label="Remove selected PDF" onClick={clearFile} type="button">
            <X aria-hidden="true" size={13} />
          </button>
        </span>
      ) : null}
    </div>
  );
}
