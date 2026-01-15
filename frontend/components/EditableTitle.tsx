"use client";

import React, { useState, useRef, useEffect } from "react";

interface EditableTitleProps {
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function EditableTitle({
  value,
  onChange,
  className = "",
  style,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    if (editValue.trim()) {
      onChange(editValue.trim().toUpperCase());
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${className} bg-transparent border-2 border-[#d4af37] outline-none px-2`}
        style={style}
      />
    );
  }

  return (
    <h1
      onClick={handleClick}
      className={`${className} cursor-pointer hover:text-[#d4af37] transition-colors`}
      style={style}
      title="Click to edit newspaper name"
    >
      {value}
    </h1>
  );
}

