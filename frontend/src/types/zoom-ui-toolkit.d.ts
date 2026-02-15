declare module "@zoom/videosdk-ui-toolkit" {
  export interface UIToolkitConfig {
    videoSDKJWT: string;
    sessionName: string;
    userName: string;
    features?: string[];
  }

  const uitoolkit: {
    joinSession(container: HTMLElement, config: UIToolkitConfig): Promise<void>;
    closeSession(container: HTMLElement): void;
  };

  export default uitoolkit;
}
