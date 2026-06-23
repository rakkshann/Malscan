import { registerPlugin } from "@capacitor/core"

export interface DefaultBrowserPlugin {
  /** Whether RoleManager.ROLE_BROWSER exists on this device (Android 10 / API 29+). */
  isRoleAvailable(): Promise<{ value: boolean }>
  /** Whether MalScan currently holds the default-browser role. */
  isDefaultBrowser(): Promise<{ value: boolean }>
  /** Shows the system "Set MalScan as your default browser?" dialog. */
  requestRole(): Promise<{ granted: boolean }>
}

const DefaultBrowser = registerPlugin<DefaultBrowserPlugin>("DefaultBrowser", {
  web: () => ({
    async isRoleAvailable() { return { value: false } },
    async isDefaultBrowser() { return { value: false } },
    async requestRole() { return { granted: false } },
  }),
})

export default DefaultBrowser
