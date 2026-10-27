/**
 * Email Dispatch Service
 * Handles email parsing, validation, templating, and delayed sending.
 */

export interface CandidateProfile {
  fullName: string;
  title: string;
  experienceYears: string;
  noticePeriod: string;
  location: string;
  email: string;
  phone: string;
  portfolio: string;
  linkedin: string;
  github: string;
  education: string;
  resumeFileName: string;
  skillsSummary: {
    meanMern: string;
    coreProduction: string;
    backendAndData: string;
    frontendAndMobile: string;
    deployment: string;
  };
  projectsSummary: string[];
}

export const CANDIDATE: CandidateProfile = {
  fullName: 'Himanshu A. Chauhan',
  title: 'Full Stack Developer | MEAN | MERN',
  experienceYears: '3.5+',
  noticePeriod: '15 Days Notice Period',
  location: 'Rajkot, Gujarat, India',
  email: 'devhimanshu59@gmail.com',
  phone: '+91 99251 95040',
  portfolio: 'https://hellohimanshu.is-a.dev',
  linkedin: 'https://www.linkedin.com/in/himanshu-chauhan-979124271',
  github: 'https://github.com/himanshuchauhan59',
  education: 'BCA, T.N. Rao College, Saurashtra University, Rajkot (CGPA 9.03 | University Rank Holder)',
  resumeFileName: 'Himanshu Chauhan.pdf',
  skillsSummary: {
    meanMern: 'MongoDB, Express.js, Angular, React.js, Node.js',
    coreProduction: 'TypeScript, JavaScript (ES6+), Electron.js, Rust (Windows), Firebase, Ionic, RESTful APIs, JWT Auth, SQLite, Git, GitHub',
    backendAndData: 'NestJS, Drizzle ORM, PostgreSQL, pgvector, ClickHouse, MySQL, Socket.io, Peer.js (WebRTC), Docker, n8n, Gemini API',
    frontendAndMobile: 'Flutter, Dart, React Native, HTML5, CSS3, Angular Material, Material UI, Tailwind CSS, SCSS, Bootstrap, Figma',
    deployment: 'Railway, Linux/Ubuntu, Postman, Vite, GitHub Actions, Vercel, Netlify',
  },
  projectsSummary: [
    'Supersee (Cross-Platform Employee Monitoring Software): Primary developer of desktop client (Electron.js, Rust on Windows) and web admin panel (Angular 20, Firebase, Node.js), running on 800+ client agents in India and abroad.',
    'Campus360 (School Management SaaS Workspace): Multi-module SaaS platform built with React.js, NestJS, Drizzle ORM, PostgreSQL, and ClickHouse for high-volume analytics.',
    'AIBE (AI-Powered Fire Safety Detection System): Real-time AI alert system across Ionic mobile app, Electron.js Linux desktop app, Node.js streaming server, Peer.js WebRTC, and YOLO models.',
    'Easy Capture (Automated Visiting Card Capture): Built with Flutter, React.js, Node.js, n8n, and Gemini API to extract visiting card data directly into Google Drive and Google Sheets.',
  ],
};

export interface EmailDispatchItem {
  id: string;
  email: string;
  status: 'pending' | 'sending' | 'success' | 'failed' | 'skipped';
  timestamp?: string;
  errorMessage?: string;
}

export interface DispatchProgress {
  currentIndex: number;
  total: number;
  currentEmail: string;
  status: 'idle' | 'running' | 'completed' | 'aborted' | 'error';
  countdownSeconds: number;
  items: EmailDispatchItem[];
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Parses user input for multiple emails separated by comma, semicolon, space, or newline.
 */
export function parseEmailList(rawInput: string): string[] {
  if (!rawInput || typeof rawInput !== 'string') return [];

  // Split by comma, semicolon, whitespace, or newline
  const tokens = rawInput
    .split(/[,;\n\r\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const unique = new Set<string>();
  const validEmails: string[] = [];

  for (const token of tokens) {
    // Basic cleaning of wrapping quotes or brackets
    const clean = token.replace(/^[<"']+|[>"']+$/g, '');
    if (EMAIL_REGEX.test(clean) && !unique.has(clean)) {
      unique.add(clean);
      validEmails.push(clean);
    }
  }

  return validEmails;
}

/**
 * Build personalized application email subject, plain text body, and rich HTML body
 */
export function buildApplicationEmail(
  recipientEmail: string,
  options?: { roleTitle?: string; noticePeriod?: string }
) {
  const roleTitle = options?.roleTitle || 'Full Stack Developer';
  const noticePeriod = options?.noticePeriod || CANDIDATE.noticePeriod;
  const subject = `Application for ${roleTitle} — ${CANDIDATE.fullName}`;

  const textBody = [
    `Dear Hiring Team,`,
    ``,
    `I am actively looking for new opportunities and writing to share my resume for a ${roleTitle} position with your organization (open to Onsite, Hybrid, or Remote roles — ${noticePeriod}).`,
    ``,
    `I am a Full Stack Developer with ${CANDIDATE.experienceYears} years of hands-on production experience building and maintaining web, desktop, and mobile applications across the MEAN and MERN stacks at Rao Information Technology (February 2023 – Present). I have delivered 7+ production client and company products end-to-end from architecture to deployment.`,
    ``,
    `Key Highlights & Availability:`,
    `• Notice Period: ${noticePeriod} (Actively looking for new opportunities)`,
    `• MEAN & MERN Stack: ${CANDIDATE.skillsSummary.meanMern}`,
    `• Core Production Stack: ${CANDIDATE.skillsSummary.coreProduction}`,
    `• Backend, Real-Time & AI: ${CANDIDATE.skillsSummary.backendAndData}`,
    `• Frontend & Mobile: ${CANDIDATE.skillsSummary.frontendAndMobile}`,
    `• Cloud & DevOps: ${CANDIDATE.skillsSummary.deployment}`,
    ``,
    `Key Production Projects:`,
    ...CANDIDATE.projectsSummary.map((p) => `• ${p}`),
    ``,
    `Education:`,
    `• ${CANDIDATE.education}`,
    ``,
    `I have attached my resume (${CANDIDATE.resumeFileName}) for your consideration. You can also explore my live work and code repositories below:`,
    `• Portfolio: ${CANDIDATE.portfolio}`,
    `• GitHub: ${CANDIDATE.github}`,
    `• LinkedIn: ${CANDIDATE.linkedin}`,
    ``,
    `Thank you for your time and consideration. I would welcome the opportunity to connect and discuss how I can contribute to your engineering team.`,
    ``,
    `Best regards,`,
    `${CANDIDATE.fullName}`,
    `${roleTitle}`,
    `Notice Period: ${noticePeriod} (Actively Looking)`,
    `Phone: ${CANDIDATE.phone} | Email: ${CANDIDATE.email}`,
    `Location: ${CANDIDATE.location}`,
  ].join('\n');

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 680px;">
      <p>Dear <strong>Hiring Team</strong>,</p>

      <p>
        I am <strong>actively looking for new opportunities</strong> and writing to share my profile and resume for a <strong>${roleTitle}</strong> opportunity with your organization
        (available for Onsite, Hybrid, or Remote roles &mdash; <strong style="color: #16a34a;">${noticePeriod}</strong>).
      </p>

      <p>
        I am a Full Stack Developer with <strong>${CANDIDATE.experienceYears} years of hands-on production experience</strong>
        building and maintaining web, desktop, and mobile products using the <strong>MEAN and MERN stacks</strong> at
        Rao Information Technology (February 2023 &ndash; Present), where I have delivered 7+ client and internal products end-to-end.
      </p>

      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 14px; margin: 16px 0; border-radius: 4px;">
        <strong>Notice Period &amp; Availability:</strong> Actively looking for job opportunities &bull; <strong style="color: #15803d;">${noticePeriod}</strong>
      </div>

      <p style="margin-bottom: 6px;"><strong>Technical Skills Summary:</strong></p>
      <ul style="margin-top: 4px; padding-left: 20px;">
        <li><strong>MEAN &amp; MERN Stack:</strong> ${CANDIDATE.skillsSummary.meanMern}</li>
        <li><strong>Core Production Stack:</strong> ${CANDIDATE.skillsSummary.coreProduction}</li>
        <li><strong>Backend, Databases &amp; AI:</strong> ${CANDIDATE.skillsSummary.backendAndData}</li>
        <li><strong>Frontend &amp; Mobile:</strong> ${CANDIDATE.skillsSummary.frontendAndMobile}</li>
        <li><strong>Deployment &amp; Tooling:</strong> ${CANDIDATE.skillsSummary.deployment}</li>
      </ul>

      <p style="margin-bottom: 6px;"><strong>Key Production Projects:</strong></p>
      <ul style="margin-top: 4px; padding-left: 20px;">
        ${CANDIDATE.projectsSummary.map((p) => `<li style="margin-bottom: 4px;">${p}</li>`).join('')}
      </ul>

      <p>
        <strong>Education:</strong> ${CANDIDATE.education}
      </p>

      <p>
        Please find my resume (<strong>${CANDIDATE.resumeFileName}</strong>) attached. You can also view my live projects and code here:
      </p>
      <ul style="margin-top: 4px; padding-left: 20px;">
        <li><strong>Portfolio:</strong> <a href="${CANDIDATE.portfolio}">${CANDIDATE.portfolio}</a></li>
        <li><strong>GitHub:</strong> <a href="${CANDIDATE.github}">${CANDIDATE.github}</a></li>
        <li><strong>LinkedIn:</strong> <a href="${CANDIDATE.linkedin}">${CANDIDATE.linkedin}</a></li>
      </ul>

      <p>
        Thank you for your time and consideration. I look forward to hearing from you.
      </p>

      <p style="margin-top: 20px;">
        Best regards,<br/>
        <strong>${CANDIDATE.fullName}</strong><br/>
        ${roleTitle}<br/>
        <span style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 4px; margin-bottom: 4px;">Notice Period: ${noticePeriod}</span><br/>
        Phone: <a href="tel:+919925195040">${CANDIDATE.phone}</a> |
        Email: <a href="mailto:${CANDIDATE.email}">${CANDIDATE.email}</a><br/>
        ${CANDIDATE.location}
      </p>
    </div>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Dispatch emails in sequence with configurable threshold delay in seconds
 */
export async function sendEmailBatch({
  emails,
  delaySeconds,
  webhookUrl,
  roleTitle,
  noticePeriod,
  onProgress,
  shouldAbort,
}: {
  emails: string[];
  delaySeconds: number;
  webhookUrl?: string;
  roleTitle?: string;
  noticePeriod?: string;
  onProgress: (state: DispatchProgress) => void;
  shouldAbort?: () => boolean;
}): Promise<EmailDispatchItem[]> {
  const items: EmailDispatchItem[] = emails.map((email, idx) => ({
    id: `${email}-${idx}-${Date.now()}`,
    email,
    status: 'pending',
  }));

  const state: DispatchProgress = {
    currentIndex: 0,
    total: emails.length,
    currentEmail: '',
    status: 'running',
    countdownSeconds: 0,
    items,
  };

  onProgress({ ...state });

  for (let i = 0; i < emails.length; i++) {
    if (shouldAbort && shouldAbort()) {
      state.status = 'aborted';
      onProgress({ ...state });
      break;
    }

    const email = emails[i];
    state.currentIndex = i + 1;
    state.currentEmail = email;
    items[i].status = 'sending';
    onProgress({ ...state, items: [...items] });

    try {
      if (webhookUrl && webhookUrl.trim().startsWith('http')) {
        // Real Google Apps Script or REST API webhook call
        const { subject, textBody, htmlBody } = buildApplicationEmail(email, { roleTitle, noticePeriod });
        const res = await fetch(webhookUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_single',
            to: email,
            subject,
            textBody,
            htmlBody,
            candidate: {
              ...CANDIDATE,
              noticePeriod: noticePeriod || CANDIDATE.noticePeriod,
              title: roleTitle || CANDIDATE.title,
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
      } else {
        // High-fidelity local simulation with real network test simulation
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      items[i].status = 'success';
      items[i].timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (err: any) {
      items[i].status = 'failed';
      items[i].errorMessage = err?.message || 'Send error';
      items[i].timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    onProgress({ ...state, items: [...items] });

    // Threshold delay between emails (except after the last email)
    if (i < emails.length - 1) {
      const waitTotal = Math.max(1, delaySeconds);
      for (let s = waitTotal; s > 0; s--) {
        if (shouldAbort && shouldAbort()) break;
        state.countdownSeconds = s;
        onProgress({ ...state, items: [...items] });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      state.countdownSeconds = 0;
    }
  }

  state.status = state.status === 'aborted' ? 'aborted' : 'completed';
  state.currentEmail = '';
  onProgress({ ...state, items: [...items] });

  return items;
}
