import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface StableInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export const StableInput = forwardRef<HTMLInputElement, StableInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const lastSelectionRef = useRef<{ start: number; end: number } | null>(null);

    useImperativeHandle(ref, () => inputRef.current!, []);

    // Preserve cursor position during re-renders
    useEffect(() => {
      const input = inputRef.current;
      if (input && lastSelectionRef.current) {
        const { start, end } = lastSelectionRef.current;
        input.setSelectionRange(start, end);
        lastSelectionRef.current = null;
      }
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Store cursor position before state update
      const input = e.target;
      lastSelectionRef.current = {
        start: input.selectionStart || 0,
        end: input.selectionEnd || 0
      };
      onChange(e);
    };

    return (
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        className={className}
        {...props}
      />
    );
  }
);

StableInput.displayName = 'StableInput';

interface StableTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

export const StableTextArea = forwardRef<HTMLTextAreaElement, StableTextAreaProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastSelectionRef = useRef<{ start: number; end: number } | null>(null);

    useImperativeHandle(ref, () => textareaRef.current!, []);

    // Preserve cursor position during re-renders
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea && lastSelectionRef.current) {
        const { start, end } = lastSelectionRef.current;
        textarea.setSelectionRange(start, end);
        lastSelectionRef.current = null;
      }
    });

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Store cursor position before state update
      const textarea = e.target;
      lastSelectionRef.current = {
        start: textarea.selectionStart || 0,
        end: textarea.selectionEnd || 0
      };
      onChange(e);
    };

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        className={className}
        {...props}
      />
    );
  }
);

StableTextArea.displayName = 'StableTextArea';

interface StableSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  children: React.ReactNode;
}

export const StableSelect = forwardRef<HTMLSelectElement, StableSelectProps>(
  ({ value, onChange, className, children, ...props }, ref) => {
    const selectRef = useRef<HTMLSelectElement>(null);

    useImperativeHandle(ref, () => selectRef.current!, []);

    return (
      <select
        ref={selectRef}
        value={value}
        onChange={onChange}
        className={className}
        {...props}
      >
        {children}
      </select>
    );
  }
);

StableSelect.displayName = 'StableSelect';