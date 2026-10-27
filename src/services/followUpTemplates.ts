/**
 * Follow-up Email Templates & Generator
 * Candidate: Himanshu A. Chauhan
 */

import { CANDIDATE } from './emailService';

export type FollowUpTemplateType = 'bump' | 'value' | 'short' | 'questionnaire';

export interface FollowUpOptions {
  recipientEmail: string;
  companyName?: string;
  roleTitle?: string;
  initialSentAt?: string;
  followUpCount?: number;
  templateType?: FollowUpTemplateType;
  noticePeriod?: string;
  candidateName?: string;
  currentCtc?: string;
  expectedCtc?: string;
  interviewAvailability?: string;
  locationComfort?: string;
}

/**
 * Intelligent extraction of company name from email address
 * e.g. "hr@rawabiholding.com" -> "Rawabi Holding"
 * e.g. "cv@arabianfal.com" -> "Arabianfal"
 * e.g. "rec@hotmail.com" -> "Hiring Team"
 */
export function extractCompanyFromEmail(email: string): string {
  if (!email || !email.includes('@')) return 'Hiring Team';

  const parts = email.toLowerCase().trim().split('@');
  const localPart = parts[0] || '';
  const domain = parts[1] || '';
  const domainName = domain.split('.')[0] || '';

  // Generic public domains: check if localPart contains company name like "hr.companyname"
  const genericDomains = new Set(['gmail', 'hotmail', 'yahoo', 'outlook', 'icloud', 'proton', 'aol']);
  if (genericDomains.has(domainName)) {
    // Check for prefixes like "hr.company", "careers.company", "jobs_company"
    const cleanedLocal = localPart.replace(/^(hr|careers|career|recruitment|jobs|contact|info)[_.-]?/, '');
    if (cleanedLocal && cleanedLocal.length >= 3 && !genericDomains.has(cleanedLocal)) {
      return cleanedLocal.charAt(0).toUpperCase() + cleanedLocal.slice(1);
    }
    return 'Hiring Team';
  }

  // Common camelCase / word separators
  const words = domainName
    .replace(/[-_.]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean);

  if (words.length === 0) return 'Hiring Team';

  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Format relative or readable sent date
 */
export function formatSentDate(isoDateString?: string): string {
  if (!isoDateString) return 'a few days ago';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return 'a few days ago';

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'a few days ago';
  }
}

/**
 * Calculate elapsed days since initial sent date
 */
export function getElapsedDays(isoDateString?: string): number {
  if (!isoDateString) return 0;
  try {
    const d = new Date(isoDateString).getTime();
    if (isNaN(d)) return 0;
    const diffMs = Date.now() - d;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

/**
 * Build pre-filled follow-up email subject, text, and HTML body
 */
export function buildFollowUpEmail(options: FollowUpOptions): {
  subject: string;
  textBody: string;
  htmlBody: string;
  companyName: string;
} {
  const email = options.recipientEmail.trim();
  const companyName = options.companyName?.trim() || extractCompanyFromEmail(email);
  const roleTitle = options.roleTitle?.trim() || 'Full Stack Developer';
  const noticePeriod = options.noticePeriod?.trim() || CANDIDATE.noticePeriod;
  const candidateName = options.candidateName?.trim() || CANDIDATE.fullName;
  const initialDateStr = formatSentDate(options.initialSentAt);
  const templateType: FollowUpTemplateType = options.templateType || 'bump';
  const followUpNumber = (options.followUpCount || 0) + 1;

  const subjectPrefix = followUpNumber > 1 ? `Follow-up #${followUpNumber}` : 'Following up';
  let subject = `${subjectPrefix}: Application for ${roleTitle} — ${candidateName}`;

  let textBody = '';
  let htmlBody = '';

  if (templateType === 'bump') {
    // 1. Gentle Bump (Best for Day 3-5)
    textBody = [
      `Dear Hiring Team,`,
      ``,
      `I hope you are having a productive week.`,
      ``,
      `I am writing to briefly follow up on my resume and application submitted on ${initialDateStr} regarding the ${roleTitle} position with your organization.`,
      ``,
      `With ${CANDIDATE.experienceYears} years of hands-on production engineering experience across the MEAN and MERN stacks, I am very enthusiastic about how my background building scalable web, desktop, and mobile products can add immediate value to your engineering team.`,
      ``,
      `Key Highlights:`,
      `• Availability: ${noticePeriod} (Actively looking for new opportunities)`,
      `• MEAN & MERN: ${CANDIDATE.skillsSummary.meanMern}`,
      `• Core Production: ${CANDIDATE.skillsSummary.coreProduction}`,
      `• Backend, Real-Time & AI: ${CANDIDATE.skillsSummary.backendAndData}`,
      ``,
      `I understand your team is likely reviewing multiple applicants, but please let me know if there are any specific questions, references, or code walkthroughs I can provide.`,
      ``,
      `My resume is re-attached for your convenience. You can also view my live portfolio and repositories below:`,
      `• Portfolio: ${CANDIDATE.portfolio}`,
      `• GitHub: ${CANDIDATE.github}`,
      `• LinkedIn: ${CANDIDATE.linkedin}`,
      ``,
      `Thank you again for your time and consideration. I look forward to connecting with your team.`,
      ``,
      `Best regards,`,
      `${candidateName}`,
      `${roleTitle}`,
      `Notice Period: ${noticePeriod} (Actively Looking)`,
      `Phone: ${CANDIDATE.phone} | Email: ${CANDIDATE.email}`,
      `Location: ${CANDIDATE.location}`,
    ].join('\n');

    htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 680px;">
        <p>Dear <strong>Hiring Team</strong>,</p>

        <p>
          I hope you are having a productive week.
        </p>

        <p>
          I am writing to briefly follow up on the application and resume I submitted on <strong>${initialDateStr}</strong>
          regarding the <strong>${roleTitle}</strong> position with your organization.
        </p>

        <p>
          With <strong>${CANDIDATE.experienceYears} years of hands-on production experience</strong> across the MEAN &amp; MERN stacks,
          I remain very enthusiastic about how my engineering background in scalable web, desktop, and mobile products can contribute to your team.
        </p>

        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 14px; margin: 16px 0; border-radius: 4px;">
          <strong>Availability &amp; Notice Period:</strong> Actively looking &bull; <strong style="color: #15803d;">${noticePeriod}</strong>
        </div>

        <p style="margin-bottom: 6px;"><strong>Core Skills Snapshot:</strong></p>
        <ul style="margin-top: 4px; padding-left: 20px;">
          <li><strong>MEAN &amp; MERN:</strong> ${CANDIDATE.skillsSummary.meanMern}</li>
          <li><strong>Production Systems:</strong> ${CANDIDATE.skillsSummary.coreProduction}</li>
          <li><strong>Backend, DBs &amp; AI:</strong> ${CANDIDATE.skillsSummary.backendAndData}</li>
        </ul>

        <p>
          I understand your team is likely reviewing multiple applicants, but please let me know if there are any additional details,
          code walkthroughs, or references I can share.
        </p>

        <p>
          Please find my resume attached. You can also explore my live projects and code below:
        </p>
        <ul style="margin-top: 4px; padding-left: 20px;">
          <li><strong>Portfolio:</strong> <a href="${CANDIDATE.portfolio}">${CANDIDATE.portfolio}</a></li>
          <li><strong>GitHub:</strong> <a href="${CANDIDATE.github}">${CANDIDATE.github}</a></li>
          <li><strong>LinkedIn:</strong> <a href="${CANDIDATE.linkedin}">${CANDIDATE.linkedin}</a></li>
        </ul>

        <p>Thank you again for your time and consideration. I would welcome the opportunity for a brief conversation.</p>

        <p style="margin-top: 20px;">
          Best regards,<br/>
          <strong>${candidateName}</strong><br/>
          ${roleTitle}<br/>
          <span style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 4px; margin-bottom: 4px;">Notice Period: ${noticePeriod}</span><br/>
          Phone: <a href="tel:+919925195040">${CANDIDATE.phone}</a> | Email: <a href="mailto:${CANDIDATE.email}">${CANDIDATE.email}</a><br/>
          ${CANDIDATE.location}
        </p>
      </div>
    `.trim();
  } else if (templateType === 'value') {
    // 2. Value-Add & Project Spotlight (Best for Day 6-10)
    textBody = [
      `Dear Hiring Team,`,
      ``,
      `I hope this email finds you well.`,
      ``,
      `I am following up on my application for the ${roleTitle} role. While you are evaluating candidates, I wanted to share a quick spotlight on two production systems I engineered that highlight the technical depth and reliability I bring to an engineering team:`,
      ``,
      `• Supersee Desktop & Cloud Monitoring: Engineered an Electron.js and Rust (Windows) desktop client and Angular web admin workspace, active in production across 800+ enterprise client agents.`,
      `• Campus360 SaaS Platform: Designed multi-tenant workspace architecture with NestJS, Drizzle ORM, and ClickHouse for real-time high-throughput telemetry.`,
      ``,
      `I would love the opportunity to discuss how my end-to-end execution across full stack architecture, real-time protocols, and database performance can support your upcoming engineering roadmap.`,
      ``,
      `Availability: ${noticePeriod} (Actively Looking)`,
      `Portfolio: ${CANDIDATE.portfolio} | GitHub: ${CANDIDATE.github}`,
      ``,
      `I've re-attached my resume for quick reference. Looking forward to your thoughts.`,
      ``,
      `Best regards,`,
      `${candidateName}`,
      `${CANDIDATE.phone} | ${CANDIDATE.email}`,
    ].join('\n');

    htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 680px;">
        <p>Dear <strong>Hiring Team</strong>,</p>

        <p>
          I hope this email finds you well.
        </p>

        <p>
          I am following up on my application for the <strong>${roleTitle}</strong> role. While you are evaluating candidates,
          I wanted to share a quick spotlight on two production systems I engineered that highlight the technical depth and execution I bring to a team:
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin: 14px 0;">
          <p style="margin: 0 0 8px 0;">
            <strong>&bull; Supersee Desktop &amp; Cloud Monitoring:</strong> Engineered Electron.js and Rust Windows client with Angular web dashboard and Firebase, active in production across <strong>800+ enterprise client agents</strong>.
          </p>
          <p style="margin: 0;">
            <strong>&bull; Campus360 SaaS Platform:</strong> Built multi-tenant architecture utilizing NestJS, Drizzle ORM, and ClickHouse for high-throughput real-time telemetry.
          </p>
        </div>

        <p>
          I would love the opportunity to discuss how my end-to-end execution across full stack architecture, performance optimization,
          and robust APIs can support your engineering goals.
        </p>

        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 14px; margin: 16px 0; border-radius: 4px;">
          <strong>Availability:</strong> <strong style="color: #15803d;">${noticePeriod}</strong> &bull; Open to Onsite, Hybrid, or Remote
        </div>

        <p>
          Please find my resume attached. Looking forward to hearing from your team!
        </p>

        <p style="margin-top: 20px;">
          Best regards,<br/>
          <strong>${candidateName}</strong><br/>
          ${roleTitle}<br/>
          Phone: <a href="tel:+919925195040">${CANDIDATE.phone}</a> | Email: <a href="mailto:${CANDIDATE.email}">${CANDIDATE.email}</a><br/>
          Portfolio: <a href="${CANDIDATE.portfolio}">${CANDIDATE.portfolio}</a> &bull; GitHub: <a href="${CANDIDATE.github}">${CANDIDATE.github}</a>
        </p>
      </div>
    `.trim();
  } else if (templateType === 'questionnaire') {
    // 4. HR Screening Questionnaire Reply (JD & Candidate Details Reply)
    const locationName = options.locationComfort || 'Ahmedabad / Onsite';
    const hrGreeting = 'Dear Hiring Team,';

    subject = `Re: Details & Availability for ${roleTitle} — ${candidateName}`;

    textBody = [
      hrGreeting,
      ``,
      `Thank you for getting in touch and sharing the company details and Job Description for the ${roleTitle} opportunity. I have reviewed the requirements, and my 3.5+ years of hands-on production experience in React.js, Node.js, and TypeScript across the MEAN/MERN stack align directly with your technical expectations.`,
      ``,
      `As requested, please find my details below:`,
      ``,
      `• Name: ${candidateName}`,
      `• Contact no: ${CANDIDATE.phone}`,
      `• Email ID: ${CANDIDATE.email}`,
      `• Apply for the post: ${roleTitle}`,
      `• Total Experience: ${CANDIDATE.experienceYears} Years (Hands-on Production)`,
      `• Current CTC: As per discussion / Confidential`,
      `• Expected CTC(Negotiable?): Negotiable (as per company standards for this position)`,
      `• Last month of increment: March 2024`,
      `• Notice Period: ${noticePeriod} (Actively Available)`,
      `• Reason for Change: Seeking new technical challenges and growth in scalable product engineering`,
      `• Current Location: ${CANDIDATE.location}`,
      `• Are you comfortable with the ${locationName} location?: Yes, completely comfortable relocating and working onsite in ${locationName}`,
      `• Availability for an interview with Date/Day/time (Video call): Available anytime with 2–4 hours advance notice (Mon–Sat, 11:00 AM – 7:00 PM IST)`,
      `• Are you comfortable with following JD?: Yes, strong hands-on production expertise in React.js, Node.js, TypeScript, RESTful/GraphQL APIs, and modern component architecture`,
      ``,
      `Portfolio: ${CANDIDATE.portfolio}`,
      `GitHub: ${CANDIDATE.github}`,
      `LinkedIn: ${CANDIDATE.linkedin}`,
      ``,
      `I have re-attached my updated resume (${CANDIDATE.resumeFileName}) for your reference. Kindly let me know the scheduled date and time slot for the video call interview.`,
      ``,
      `Thanks & Regards,`,
      `${candidateName}`,
      `${roleTitle}`,
      `${CANDIDATE.phone} | ${CANDIDATE.email}`,
    ].join('\n');

    htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 680px;">
        <p><strong>${hrGreeting}</strong></p>

        <p>
          Thank you for getting in touch and sharing the company details and Job Description for the <strong>${roleTitle}</strong> opportunity.
          I have reviewed the requirements, and my <strong>3.5+ years of hands-on production experience</strong> in React.js, Node.js, and TypeScript across the MEAN/MERN stack align directly with your technical expectations.
        </p>

        <p>As requested, please find my details below for your review:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
          <tbody>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 12px; font-weight: 600; width: 38%; color: #4b5563;">Name</td>
              <td style="padding: 8px 12px; font-weight: 600; color: #111827;">${candidateName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Contact No</td>
              <td style="padding: 8px 12px; color: #111827;"><a href="tel:+919925195040">${CANDIDATE.phone}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Email ID</td>
              <td style="padding: 8px 12px; color: #111827;"><a href="mailto:${CANDIDATE.email}">${CANDIDATE.email}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Applying for the Post</td>
              <td style="padding: 8px 12px; font-weight: 600; color: #111827;">${roleTitle}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Total Experience</td>
              <td style="padding: 8px 12px; color: #111827;"><strong>${CANDIDATE.experienceYears} Years</strong> (Hands-on Production)</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Current CTC</td>
              <td style="padding: 8px 12px; color: #111827;">As per discussion / Confidential</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Expected CTC</td>
              <td style="padding: 8px 12px; color: #111827;">Negotiable (as per company standards)</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Last Month of Increment</td>
              <td style="padding: 8px 12px; color: #111827;">March 2024</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Notice Period</td>
              <td style="padding: 8px 12px; color: #15803d; font-weight: 700;">${noticePeriod} (Actively Available)</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Reason for Change</td>
              <td style="padding: 8px 12px; color: #111827;">Seeking new technical challenges in scalable product engineering</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Current Location</td>
              <td style="padding: 8px 12px; color: #111827;">${CANDIDATE.location}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f0fdf4;">
              <td style="padding: 8px 12px; font-weight: 600; color: #166534;">Comfortable with ${locationName} Location?</td>
              <td style="padding: 8px 12px; font-weight: 600; color: #15803d;">&check; Yes, completely comfortable relocating and working onsite</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 12px; font-weight: 600; color: #4b5563;">Interview Availability (Video Call)</td>
              <td style="padding: 8px 12px; color: #111827;">Available anytime with 2&ndash;4 hours advance notice (Mon&ndash;Sat, 11:00 AM &ndash; 7:00 PM)</td>
            </tr>
            <tr style="background-color: #f0fdf4;">
              <td style="padding: 8px 12px; font-weight: 600; color: #166534;">Comfortable with the JD?</td>
              <td style="padding: 8px 12px; font-weight: 600; color: #15803d;">&check; Yes, fully comfortable with the required tech stack and responsibilities</td>
            </tr>
          </tbody>
        </table>

        <p>
          Please find my updated resume attached (<strong>${CANDIDATE.resumeFileName}</strong>). You can also view my live code and projects:
        </p>
        <ul style="margin-top: 4px; padding-left: 20px;">
          <li><strong>Portfolio:</strong> <a href="${CANDIDATE.portfolio}">${CANDIDATE.portfolio}</a></li>
          <li><strong>GitHub:</strong> <a href="${CANDIDATE.github}">${CANDIDATE.github}</a></li>
          <li><strong>LinkedIn:</strong> <a href="${CANDIDATE.linkedin}">${CANDIDATE.linkedin}</a></li>
        </ul>

        <p>Kindly let me know the scheduled date and time slot for the video call interview.</p>

        <p style="margin-top: 20px;">
          Best regards,<br/>
          <strong>${candidateName}</strong><br/>
          ${roleTitle}<br/>
          Phone: <a href="tel:+919925195040">${CANDIDATE.phone}</a> | Email: <a href="mailto:${CANDIDATE.email}">${CANDIDATE.email}</a>
        </p>
      </div>
    `.trim();
  } else {
    // 3. Short & Direct Status Check (High Response on Mobile)
    textBody = [
      `Dear Hiring Team,`,
      ``,
      `I hope you are having a great week!`,
      ``,
      `I wanted to check in regarding my application for the ${roleTitle} opportunity submitted on ${initialDateStr}. Could you let me know if the position is currently open and what the next steps in your hiring process look like?`,
      ``,
      `I am actively available with a ${noticePeriod} and would be glad to hop on a quick 10-minute introductory call at your convenience.`,
      ``,
      `Resume attached. Portfolio: ${CANDIDATE.portfolio}`,
      ``,
      `Thanks again for your time!`,
      ``,
      `Best regards,`,
      `${candidateName}`,
      `${CANDIDATE.phone} | ${CANDIDATE.email}`,
    ].join('\n');

    htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 680px;">
        <p>Dear <strong>Hiring Team</strong>,</p>

        <p>
          I hope you are having a great week!
        </p>

        <p>
          I wanted to check in regarding my application for the <strong>${roleTitle}</strong> opportunity submitted on <strong>${initialDateStr}</strong>.
          Could you let me know if the role is currently open and what your hiring timeline looks like?
        </p>

        <p>
          I am actively available to join with a <strong style="color: #16a34a;">${noticePeriod}</strong> and would be glad to hop on a quick 10-minute introductory call at your convenience.
        </p>

        <p>
          Resume is attached. You can also view my live projects at <a href="${CANDIDATE.portfolio}">${CANDIDATE.portfolio}</a>.
        </p>

        <p>
          Thanks again for your time and consideration!
        </p>

        <p style="margin-top: 20px;">
          Best regards,<br/>
          <strong>${candidateName}</strong><br/>
          ${roleTitle}<br/>
          Phone: <a href="tel:+919925195040">${CANDIDATE.phone}</a> | Email: <a href="mailto:${CANDIDATE.email}">${CANDIDATE.email}</a>
        </p>
      </div>
    `.trim();
  }

  return { subject, textBody, htmlBody, companyName };
}
