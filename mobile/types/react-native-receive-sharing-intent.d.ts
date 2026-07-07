declare module 'react-native-receive-sharing-intent' {
  interface ReceivedFile {
    filePath: string | null
    text: string | null
    webLink: string | null
    mimeType: string | null
    contentUri: string | null
    fileName: string | null
    extension: string | null
  }

  const ReceiveSharingIntent: {
    getReceivedFiles(
      onReceive: (files: ReceivedFile[]) => void,
      onError: (error: Error) => void,
      scheme?: string
    ): void
    clearReceivedFiles(): void
  }

  export default ReceiveSharingIntent
}
