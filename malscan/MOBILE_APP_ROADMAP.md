# MALSCAN Mobile App Development Roadmap

This document outlines the detailed, step-by-step technical roadmap for building the MALSCAN Android mobile app and integrating it with the existing backend. 

We will use **React Native** (specifically the **Expo** framework) because it allows us to build a premium, fluid UI using your existing React knowledge, while giving us the hooks we need to drop down into native Android code to intercept files.

---

## Step 1: Prepare the Existing Backend for Mobile Access
Right now, the backend runs on `localhost`, which means a phone cannot reach it natively.
1. **Network Binding:** We must change the Uvicorn run command to bind to all network interfaces (`uvicorn app.main:app --host 0.0.0.0 --port 8000`). This allows a phone on the same Wi-Fi network to communicate with the backend during local development.
2. **Endpoint Verification:** We will test the existing `/upload` and `/status/{job_id}` endpoints using Postman or cURL to ensure they gracefully handle multipart form data from a mobile client.

## Step 2: Initialize the Mobile Project
We will create a new mobile application directory alongside the existing web and backend folders.
1. **Project Scaffolding:** Run `npx create-expo-app@latest malscan-mobile` to create the React Native project.
2. **Install Core Dependencies:**
   *   `axios` (for API requests to the backend)
   *   `expo-intent-launcher` & `expo-sharing` (to handle passing safe files back to the OS)
   *   `expo-file-system` (to manage the raw bytes of intercepted files)
   *   `framer-motion` or `react-native-reanimated` (to recreate the premium UI animations from your web platform).

## Step 3: Implement the "Airlock" (Native Android Intent Filters)
This is the most critical step. We have to tell the Android OS that MALSCAN is a file viewer.
1. **Eject to Prebuild:** Because we are modifying native Android configuration, we use Expo's app config (`app.json`) and run `npx expo prebuild` to generate the native `android/` directory.
2. **Modify AndroidManifest.xml:** We will inject the `intent-filter` into the `AndroidManifest.xml` file.
   *   We define `android.intent.action.VIEW`.
   *   We map specific MIME types: `application/pdf`, `application/zip`, `application/vnd.android.package-archive` (APK).
3. **Capture the Intent in React Native:** When the app launches, we need to know *why* it launched. We will write a hook (using `expo-linking` or native modules) that reads the incoming Intent data. If the app was launched by tapping a file in WhatsApp, this hook will extract the raw `file://` or `content://` URI.

## Step 4: The File Upload Engine (React Native to FastAPI)
Once MALSCAN has intercepted the file URI, we must securely transport it to the backend.
1. **Read the File:** Use `expo-file-system` to read the file from the incoming `content://` URI into temporary app memory.
2. **The Upload Request:** Construct a `FormData` object in React Native, append the file, and make an Axios `POST` request to `http://<your-backend-ip>:8000/upload`.
3. **The Polling Mechanism:** The backend immediately returns a `job_id`. We write a `useEffect` polling loop that hits `/status/{job_id}` every 2 seconds until the status changes to `"Completed"`.

## Step 5: Build the Scanning UI & Threat Presentation
While the file is uploading and scanning, the user must be visually engaged to prevent them from closing the app.
1. **The Airlock Screen:** Build a sleek, dark-mode view that renders immediately when the app intercepts a file. We will implement dynamic text that cycles through the scanning phases (e.g., "Extracting Strings...", "Checking VirusTotal...").
2. **The Verdict Screen:** Once the JSON response is received from the backend:
   *   **If Safe (Score < 30):** Render a green interface. Show the basic file metadata.
   *   **If Suspicious/Malicious (Score > 30):** Render a stark red warning interface, heavily emphasizing the Threat Score and pulling the top reasons from the backend's scoring engine.

## Step 6: The "Pass-Through" (Returning safe files to the OS)
If MALSCAN determines the file is safe, the user needs to actually open it.
1. **The Safe Button:** We add a "Continue to Open" button on the Green UI.
2. **The Handoff:** When tapped, we use `expo-intent-launcher` to fire a *new* Android Intent, basically saying to the OS: *"I am done with this file, please open it using the standard PDF viewer or APK installer."* 
3. **The Cleanup:** We immediately use `expo-file-system` to delete the temporary copy of the file we held in MALSCAN's memory to prevent storage bloat.

## Step 7: Implement the "Share Target" (For URLs and Images)
To handle the edge cases where the user receives a URL or an image in WhatsApp:
1. **Configure Share Extension:** Update the `app.json` or native Android files to register MALSCAN as a receiver for the `ACTION_SEND` intent (this is the OS "Share" menu).
2. **Handle Text/URLs:** If the incoming share intent contains raw text, we parse it for a URL and send it directly to your backend's `/submit-url` endpoint.
3. **Half-Screen UI:** We style this specific view as a bottom-sheet modal, so it feels like a quick check rather than a full app launch.
