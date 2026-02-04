import { useInput, type Key } from "ink";

type KeyHandler = (input: string, key: Key) => void;

export function useAppKeyboard(handler: KeyHandler) {
  useInput((input, key) => {
    handler(input, key);
  });
}

export function useEscape(onEscape: () => void) {
  useInput((input, key) => {
    if (key.escape) {
      onEscape();
    }
  });
}


