import React, { useState, useEffect } from "react";
import { useKeyboard } from "@opentui/react";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  focused: boolean;
  label?: string;
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  focused,
  label = "Search: ",
}: SearchFieldProps) {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  // Sync cursor position if value is cleared externally
  useEffect(() => {
    if (value === "") {
      setCursorPosition(0);
    } else if (cursorPosition > value.length) {
      setCursorPosition(value.length);
    }
  }, [value]);

  useKeyboard(
    (key) => {
      if (!focused) return;

      const { name, sequence, ctrl, meta } = key;

      // Handle Enter/Return
      if (name === "return" || name === "enter") {
        onSubmit(value);
        return;
      }

      // Handle Backspace
      if (name === "backspace") {
        if (cursorPosition > 0) {
          const newValue =
            value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition - 1);
        }
        return;
      }

      // Handle Delete
      if (name === "delete") {
        if (cursorPosition < value.length) {
          const newValue =
            value.slice(0, cursorPosition) + value.slice(cursorPosition + 1);
          onChange(newValue);
        }
        return;
      }

      // Handle Left Arrow
      if (name === "left") {
        setCursorPosition(Math.max(0, cursorPosition - 1));
        return;
      }

      // Handle Right Arrow
      if (name === "right") {
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
        return;
      }

      // Handle Home
      if (name === "home") {
        setCursorPosition(0);
        return;
      }

      // Handle End
      if (name === "end") {
        setCursorPosition(value.length);
        return;
      }

      // Handle Character Input
      // We check for length 1 and ensure no modifiers are held
      if (sequence.length === 1 && !ctrl && !meta) {
        const newValue =
          value.slice(0, cursorPosition) + sequence + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(cursorPosition + 1);
        return;
      }
    },
    { release: false }
  );

  const renderText = () => {
    if (!focused) {
      return <text fg="white">{value || " "}</text>;
    }

    const before = value.slice(0, cursorPosition);
    const charAtCursor = value[cursorPosition] || " ";
    const after = value.slice(cursorPosition + 1);

    return (
      <box flexDirection="row">
        <text fg="white">{before}</text>
        <text fg="black" bg="white">
          {charAtCursor}
        </text>
        <text fg="white">{after}</text>
      </box>
    );
  };

  return (
    <box flexDirection="row">
      <text fg="cyan">{label}</text>
      {renderText()}
    </box>
  );
}
