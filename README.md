# Job Dispatch Pro

Job Dispatch Pro is a cross-platform mobile and web application built with React Native and Expo SDK 58. It functions as an automated outreach command center for software engineers, enabling cold job application delivery, multi-stage follow-up tracking, email template management, and rate-limited email dispatching via a serverless Google Apps Script backend.

---

## Architecture Overview

```
                          +-------------------------------+
                          |   React Native / Expo App     |
                          |        (Expo Router)          |
                          +---------------+---------------+
                                          |
        +------------------+--------------+--------------+------------------+
        |                  |                             |                  |
+-------v-------+  +-------v-------+             +-------v-------+  +-------v-------+
|  1. Dispatch  |  | 2. Templates  |             | 3. Follow-ups |  |  4. Settings  |
| Bulk outreach |  | Fast copy hub |             | Outreach CRM  |  | Config & ping |
|  rate control |  | bracket audit |             | batch follow  |  | GAS webhook   |
+-------+-------+  +---------------+             +-------+-------+  +-------+-------+
        |                                                |                  |
        +------------------------+-----------------------+                  |
                                 |                                          |
                                 v                                          |
                 +-------------------------------+                          |
                 | Google Apps Script Webhook    |<-------------------------+
                 | (Executes in Google Workspace)|
                 +---------------+---------------+
                                 |
                 +---------------+---------------+
                 |                               |
                 v                               v
    +-------------------------+     +-------------------------+
    | Gmail API Email Send    |     | Google Drive PDF Resume |
    | Native sender inbox     |     | Automatic attachment    |
    +-------------------------+     +-------------------------+
```

---

## Features

### 1. Automated Job Dispatch
- Dispatches personalized job application emails to company hiring teams and recruiters.
- Automatically attaches your candidate PDF resume fetched on the fly from Google Drive.
- Built-in sender rate-limiting protection with configurable inter-email delay (default 3 seconds) to safeguard email deliverability.
- Real-time dispatch terminal displaying progress, success counters, and failure alerts.

### 2. Standalone Templates Hub
- Full-screen text viewer built for 1-tap clipboard copying to external platforms (LinkedIn InMail, job boards, and email clients).
- Includes 6 pre-built production templates:
  - Initial Job Application (cold outreach with project spotlight).
  - Gentle Follow-up Bump (polite Day 3-5 thread reply).
  - Value-Add & Project Spotlight (Day 6-10 engineering metrics focus).
  - Short Status Check-in (brief 2-sentence availability check).
  - HR Screening Questionnaire Reply (comprehensive compensation, notice period, and availability details).
  - LinkedIn Direct Message (concise InMail for recruiters).
- Unfilled Placeholder Detection: Automatically scans for text enclosed in square brackets (such as `[Day, date, time]` or `[Name]`) and presents a visual warning pill to ensure unedited text is never sent.

### 3. Follow-Up CRM
- Tracks the delivery history, timestamp, and follow-up stage of every company contacted.
- Long-press multi-card selection allowing users to select multiple companies simultaneously.
- Batch follow-up dispatching with pre-send review of subject and email body.
- Automatic filtering for records that require follow-up attention.

### 4. Configuration & Webhook Manager
- Secure local persistence via AsyncStorage.
- Real-time Google Apps Script Webhook tester with ping response latency feedback.
- Customizable notice period, target role title, and inter-email dispatch delays.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.88 with Expo SDK 58 |
| Routing | Expo Router (standard tab-based navigation) |
| UI Architecture | Vanilla React Native StyleSheet with custom iOS-inspired theme tokens |
| State & Storage | React Context API (`ConfigContext`) + `@react-native-async-storage/async-storage` |
| Clipboard Integration | `expo-clipboard` with browser `navigator.clipboard` fallback |
| Icons | `@expo/vector-icons` (Ionicons) |
| Backend | Google Apps Script (`GoogleAppsScript.js`) with Gmail API and Google Drive |

---

## Getting Started

### Prerequisites
- Node.js (v18.x or v20.x recommended)
- npm or yarn
- Expo Go app on your physical mobile device, or an iOS Simulator / Android Emulator

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd jobs-emailing
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Run on your preferred platform:
   - Press `a` for Android emulator or device via ADB.
   - Press `i` for iOS simulator.
   - Press `w` for Web browser.
   - Scan the QR code using the Expo Go mobile application.

---

## Backend Deployment (Google Apps Script)

The application communicates with a lightweight, serverless Google Apps Script webhook to deliver emails through your authentic Gmail account without third-party email service fees.

### Step-by-Step Backend Setup

1. Open [Google Apps Script](https://script.google.com/) and create a new project.
2. Copy the contents of `GoogleAppsScript.js` from the repository root into `Code.gs`.
3. Upload your PDF resume (e.g., `Himanshu Chauhan.pdf`) to your Google Drive root directory.
4. Ensure the file name in `GoogleAppsScript.js` matches your Google Drive PDF file name:
   ```javascript
   const RESUME_FILE_NAME = "Himanshu Chauhan.pdf";
   ```
5. Click **Deploy** -> **New Deployment**.
6. Select **Web app**:
   - **Execute as**: *Me (your email address)*
   - **Who has access**: *Anyone*
7. Click **Deploy** and authorize the necessary Gmail and Google Drive permissions.
8. Copy the generated **Web App URL**.
9. In the mobile app, navigate to the **Settings** tab, paste the Web App URL into the **Webhook URL** field, and tap **Test Webhook** to verify connectivity.

---

## Project Structure

```
jobs-emailing/
├── assets/                       # Static images, icons, and splash screens
├── src/
│   ├── app/                      # Expo Router screen routes
│   │   ├── _layout.tsx           # Root navigation layout (4 bottom tabs)
│   │   ├── index.tsx             # Dispatch screen (bulk application sender)
│   │   ├── templates.tsx         # Standalone full-screen template copy viewer
│   │   ├── followups.tsx         # Follow-up CRM & batch dispatch
│   │   └── settings.tsx          # Configuration, profile defaults & webhook test
│   ├── components/               # Reusable UI components
│   │   └── animated-icon.tsx     # Animated splash overlay component
│   ├── constants/                # Static application data & initial logs
│   ├── context/
│   │   └── ConfigContext.tsx     # AsyncStorage configuration provider
│   └── services/
│       ├── copyTemplates.ts      # Standalone copy template definitions
│       ├── emailService.ts       # Cold dispatch payload builder & HTTP transport
│       ├── followUpStorage.ts    # Follow-up status persistence engine
│       └── followUpTemplates.ts  # Dynamic follow-up email generator
├── GoogleAppsScript.js           # Serverless Gmail + Drive webhook backend
├── app.json                      # Expo application manifest
├── package.json                  # Dependencies and execution scripts
├── tsconfig.json                 # TypeScript compiler configuration
└── README.md                     # Project documentation
```

---

## Contributing

Contributions to improve features, UI ergonomics, or email dispatch reliability are welcome.

### Contribution Guidelines
1. Fork the repository and create a descriptive feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Maintain clean code adhering to the project's design conventions:
   - TypeScript Strictness: All new features must pass type check without errors (`npx tsc --noEmit`).
   - Iconography: Use `@expo/vector-icons` (Ionicons). Do not introduce emojis in the UI, code, or logs.
   - Styling: Use standard React Native `StyleSheet` objects without inline magic values.
3. Test your changes on both dark and light modes.
4. Commit your changes with descriptive commit messages following Conventional Commits format:
   ```bash
   git commit -m "feat(templates): add placeholder highlight indicator"
   ```
5. Push to your branch and open a Pull Request.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
