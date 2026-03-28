interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
  display_id: string;
}

interface Window {
  constchat?: {
    platform: string;
    // Window controls (DesktopTitleBar)
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizeChange: (cb: (maximized: boolean) => void) => void;
    // Screen share (ScreenShareModal)
    getDesktopSources?: () => Promise<DesktopSource[]>;
    setScreenShareAudio?: (enabled: boolean) => Promise<void>;
    setSelectedSource?: (sourceId: string) => Promise<void>;
  };
}
