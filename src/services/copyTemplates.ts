/**
 * Standalone Copy Templates Repository
 * Used exclusively in the Template Viewer for direct copying.
 * Not linked or dependent on any other screen.
 */

export interface CopyTemplate {
  id: string;
  name: string;
  tag: string;
  subject: string;
  body: string;
  content: string;
}

// Any text still inside [square brackets] must be filled in before sending.
export const hasUnfilledPlaceholder = (text: string): boolean => /\[[^\]]+\]/.test(text);

export const copyTemplates: CopyTemplate[] = [
  {
    id: 'initial_application',
    name: 'Initial Job Application',
    tag: 'Cold Application',
    subject: 'Application for Full Stack Developer — Himanshu A. Chauhan (3.5+ yrs, MEAN/MERN)',
    body: `Dear Hiring Team,

I'm a Full Stack Developer with 3.5+ years of experience in MEAN and MERN, applying for the Full Stack Developer role at your company.

- Primary developer of Supersee (Electron.js, Rust, Angular 20, Node.js), a cross-platform employee monitoring product running on 800+ client agents in India and abroad.
- Delivered 7+ client and company projects end to end, including REST APIs, JWT authentication, real-time systems and Gemini API integrations.
- Built Easy Capture (Flutter, React.js, Node.js, n8n, Gemini API), used by 11 salespeople at a client.
- Currently building Campus360, a school management SaaS (React.js, NestJS, PostgreSQL, ClickHouse), in development.

Notice period: 15 days. Based in Rajkot (hybrid or remote preferred).

My resume is attached.
Portfolio: https://hellohimanshu.is-a.dev
GitHub: https://github.com/himanshuchauhan59
LinkedIn: https://www.linkedin.com/in/himanshu-chauhan-979124271

Thank you for your time.

Best regards,
Himanshu A. Chauhan
Full Stack Developer
+91 99251 95040 | devhimanshu59@gmail.com`,
    get content() {
      return this.body;
    },
  },

  {
    id: 'followup_gentle_bump',
    name: 'Gentle Follow-Up Bump',
    tag: 'Follow-up (Day 3-5)',
    // Send as a reply in the same email thread.
    subject: 'Re: Application for Full Stack Developer — Himanshu A. Chauhan',
    body: `Dear Hiring Team,

I hope you're having a good week. I'm following up on my application for the Full Stack Developer role, which I sent a few days ago.

I have 3.5+ years of experience in MEAN and MERN, and I'm the primary developer of Supersee, a product running on 800+ client agents. I'm available on 15 days' notice.

If you need anything else, such as a code walkthrough or more details about my projects, please let me know. My resume is attached again for convenience.

Portfolio: https://hellohimanshu.is-a.dev
GitHub: https://github.com/himanshuchauhan59

Thank you for your time.

Best regards,
Himanshu A. Chauhan
+91 99251 95040 | devhimanshu59@gmail.com`,
    get content() {
      return this.body;
    },
  },

  {
    id: 'followup_value_spotlight',
    name: 'Value-Add & Project Spotlight',
    tag: 'Follow-up (Day 6-10)',
    subject: 'Re: Application for Full Stack Developer — Himanshu A. Chauhan',
    body: `Dear Hiring Team,

I hope you're well. I'm following up on my application for the Full Stack Developer role, and wanted to share two projects that show what I can bring to your team:

- Supersee: I'm the primary developer of this cross-platform employee monitoring product (Electron.js client with a Rust implementation on Windows, Angular 20 admin panel). It runs on 800+ client agents, with continuous releases over almost two years.
- Easy Capture: a Flutter app, React.js dashboard and Node.js server, with an n8n pipeline that uses the Gemini API to extract details from visiting cards into Google Sheets. It is used by 11 salespeople at a client.

I'd be glad to discuss how this experience fits your roadmap. I'm available on 15 days' notice.

Portfolio: https://hellohimanshu.is-a.dev
GitHub: https://github.com/himanshuchauhan59

My resume is attached again for quick reference.

Best regards,
Himanshu A. Chauhan
+91 99251 95040 | devhimanshu59@gmail.com`,
    get content() {
      return this.body;
    },
  },

  {
    id: 'followup_short_checkin',
    name: 'Short Status Check-in',
    tag: 'Quick Follow-up',
    subject: 'Re: Application for Full Stack Developer — Himanshu A. Chauhan',
    body: `Dear Hiring Team,

I hope you're having a great week.

I wanted to check in on my application for the Full Stack Developer role. Could you let me know if the position is still open and what the next steps are?

I'm available on 15 days' notice and happy to have a quick introductory call at your convenience.

Resume attached. Portfolio: https://hellohimanshu.is-a.dev

Thank you for your time.

Best regards,
Himanshu A. Chauhan
+91 99251 95040 | devhimanshu59@gmail.com`,
    get content() {
      return this.body;
    },
  },

  {
    id: 'hr_questionnaire_reply',
    name: 'HR Screening Questionnaire Reply',
    tag: 'Recruiter Response',
    subject: 'Re: Details & Availability for Full Stack Developer — Himanshu A. Chauhan',
    body: `Dear Hiring Team,

Thank you for getting in touch. Please find my details below:

• Name: Himanshu A. Chauhan
• Contact no: +91 99251 95040
• Email ID: devhimanshu59@gmail.com
• Applying for: Full Stack Developer
• Total Experience: 3.5+ years (February 2023 – present)
• Relevant Experience: 3.5+ years (MEAN/MERN, TypeScript)
• Current CTC: ₹3.96 LPA
• Expected CTC: ₹4.10 LPA (negotiable based on the role and responsibilities)
• Last increment: October 2025, ₹25,000 → ₹33,000 per month (about 32%)
• Notice Period: 15 days
• Reason for Change: Looking for larger products and stronger growth in full stack work
• Current Location: Rajkot, Gujarat, India
• Comfortable with the job location / onsite: [Yes / Hybrid preferred]
• Availability for interview: [Day, date, time] / [Day, date, time] / [Day, date, time]
• Comfortable with the JD: Yes, I have hands-on experience with React.js, Node.js, TypeScript and REST APIs

Portfolio: https://hellohimanshu.is-a.dev
GitHub: https://github.com/himanshuchauhan59
LinkedIn: https://www.linkedin.com/in/himanshu-chauhan-979124271

My resume is attached for your reference. Please let me know the date and time for the interview.

Thanks & Regards,
Himanshu A. Chauhan
Full Stack Developer
+91 99251 95040 | devhimanshu59@gmail.com`,
    get content() {
      return this.body;
    },
  },

  {
    id: 'linkedin_inmail_outreach',
    name: 'LinkedIn / Recruiter Direct Message',
    tag: 'InMail / DM',
    subject: 'Full Stack Developer (MEAN / MERN), 15 days notice — Himanshu A. Chauhan',
    body: `Hi [Name],

I'm a Full Stack Developer (MEAN/MERN) with 3.5+ years of experience and the primary developer of Supersee, a product running on 800+ client agents (Electron.js, Rust, Angular 20, Node.js). I'm looking for Full Stack, Node.js, Angular or React opportunities and can join on 15 days' notice. Do you have any openings that fit? My portfolio: hellohimanshu.is-a.dev. I'm happy to share my resume.

Thank you,
Himanshu`,
    get content() {
      return this.body;
    },
  },
];

// Alias for backwards compatibility
export const COPY_TEMPLATES = copyTemplates;
