/** How a modifier shortcut is written here: ⌘K on a Mac, Ctrl K everywhere else. Both keys work on both. */
export const shortcut = (key: string, platform = navigator.platform) =>
  /Mac|iPhone|iPad/.test(platform) ? `⌘${key}` : `Ctrl ${key}`
