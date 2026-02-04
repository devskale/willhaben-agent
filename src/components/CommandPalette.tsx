import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface CommandPaletteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  commands: string[];
}

export function CommandPalette({
  value,
  onChange,
  onSubmit,
  commands,
}: CommandPaletteProps) {
  const suggestions = commands.filter((c) => c.startsWith(value));

  return (
    <Box
      marginTop={1}
      borderStyle="round"
      borderColor="yellow"
      flexDirection="column"
    >
      <Box>
        <Text color="yellow">COMMAND: </Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          focus={true}
        />
      </Box>
      <Box marginTop={0}>
        {suggestions.map((c) => (
          <Text key={c} color="dim">
            {c}{" "}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
