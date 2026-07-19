import { registerPlugin } from "@capacitor/core"

export interface OpenFilePlugin {
  /** Opens path with whatever app the user picks for mimeType (Android "Open with" chooser). */
  open(options: { path: string; mimeType?: string }): Promise<void>
}

const OpenFile = registerPlugin<OpenFilePlugin>("OpenFile", {
  web: () => ({
    async open() {
      throw new Error("Opening a file natively is only supported in the packaged app.")
    },
  }),
})

export default OpenFile
