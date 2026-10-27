/* eslint-disable */
/**
 * ============================================================================
 * PRODUCTION GOOGLE APPS SCRIPT BACKEND FOR HIMANSHU CHAUHAN'S JOB APP
 * ============================================================================
 * Candidate: Himanshu A. Chauhan (Full Stack Developer | MEAN | MERN)
 * Gmail: devhimanshu59@gmail.com
 *
 * HOW TO DEPLOY IN 2 MINUTES:
 * 1. Open your browser and go to: https://script.google.com
 * 2. Click "+ New project".
 * 3. Delete any default code in Code.gs, and PASTE THIS ENTIRE FILE.
 * 4. Ensure your resume PDF named "Himanshu Chauhan.pdf" is uploaded to your
 *    Google Drive (https://drive.google.com) in your root drive folder.
 * 5. (Optional) Run `testSendToMyself()` inside the editor to verify sending.
 * 6. Click "Deploy" (top right blue button) -> "New deployment".
 * 7. Click the gear icon next to "Select type" and choose "Web app".
 * 8. Set:
 *      - Description: "Job Email Dispatcher API v1"
 *      - Execute as: "Me (devhimanshu59@gmail.com)"
 *      - Who has access: "Anyone"
 * 9. Click "Deploy" -> "Authorize access" (Select your account -> Advanced -> Go to project).
 * 10. Copy the "Web app URL" (e.g. https://script.google.com/macros/s/.../exec).
 * 11. Open your React Native app -> Go to "Settings" -> Paste this URL -> Tap "Test Connection"!
 * ============================================================================
 */

// Configuration
const CONFIG = {
  candidateName: 'Himanshu A. Chauhan',
  candidateEmail: 'devhimanshu59@gmail.com',
  resumeFileName: 'Himanshu Chauhan.pdf',
  resumeFileId: '',
  defaultRoleTitle: 'Full Stack Developer',
  defaultNoticePeriod: '15 Days Notice Period',
  phone: '+91 99251 95040',
  portfolio: 'https://hellohimanshu.is-a.dev',
  linkedin: 'https://www.linkedin.com/in/himanshu-chauhan-979124271',
  github: 'https://github.com/himanshuchauhan59',
  education: 'BCA, T.N. Rao College, Saurashtra University, Rajkot (CGPA 9.03 | University Rank Holder)',
  skillsSummary: {
    meanMern: 'MongoDB, Express.js, Angular, React.js, Node.js',
    coreProduction: 'TypeScript, JavaScript (ES6+), Electron.js, Rust (Windows), Firebase, Ionic, RESTful APIs, JWT Auth, SQLite, Git, GitHub',
    backendAndData: 'NestJS, Drizzle ORM, PostgreSQL, pgvector, ClickHouse, MySQL, Socket.io, Peer.js (WebRTC), Docker, n8n, Gemini API',
    frontendAndMobile: 'Flutter, Dart, React Native, HTML5, CSS3, Angular Material, Material UI, Tailwind CSS, SCSS, Bootstrap, Figma',
    deployment: 'Railway, Linux/Ubuntu, Postman, Vite, GitHub Actions, Vercel, Netlify'
  },
  projectsSummary: [
    'Supersee (Cross-Platform Employee Monitoring Software): Primary developer of desktop client (Electron.js, Rust on Windows) and web admin panel (Angular 20, Firebase, Node.js), running on 800+ client agents in India and abroad.',
    'Campus360 (School Management SaaS Workspace): Multi-module SaaS platform built with React.js, NestJS, Drizzle ORM, PostgreSQL, and ClickHouse for high-volume analytics.',
    'AIBE (AI-Powered Fire Safety Detection System): Real-time AI alert system across Ionic mobile app, Electron.js Linux desktop app, Node.js streaming server, Peer.js WebRTC, and YOLO models.',
    'Easy Capture (Automated Visiting Card Capture): Built with Flutter, React.js, Node.js, n8n, and Gemini API to extract visiting card data directly into Google Drive and Google Sheets.'
  ]
};

/**
 * Handle GET requests
 * Used for Health Check, Testing connection from mobile app, and Fetching Recruiter Replies
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'health';

    // 1. Fetch Recruiter Replies
    if (action === 'replies') {
      const replies = fetchRecruiterReplies();
      return jsonResponse({
        success: true,
        action: 'replies',
        count: replies.length,
        replies: replies
      });
    }

    // 2. Default Health Check
    const resumeInfo = findResumeFile();
    return jsonResponse({
      status: 'active',
      service: 'Himanshu Job Dispatch Backend',
      candidate: CONFIG.candidateName,
      email: CONFIG.candidateEmail,
      resumeFileName: CONFIG.resumeFileName,
      resumeFound: resumeInfo.found,
      resumeFileSize: resumeInfo.size ? Math.round(resumeInfo.size / 1024) + ' KB' : 'N/A',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message || 'Unknown GET error'
    });
  }
}

/**
 * Handle POST requests
 * Called by the React Native app when sending emails or querying data
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action || 'send_single';

    // Action 1: Send single application email or follow-up email
    if (action === 'send_single' || action === 'send_followup') {
      const result = sendSingleApplication(payload);
      return jsonResponse(result);
    }

    // Action 2: Batch send multiple emails
    if (action === 'send_batch') {
      const results = sendBatchApplications(payload);
      return jsonResponse(results);
    }

    // Action 3: Fetch Recruiter Replies
    if (action === 'fetch_replies') {
      const replies = fetchRecruiterReplies();
      return jsonResponse({
        success: true,
        count: replies.length,
        replies: replies
      });
    }

    return jsonResponse({
      success: false,
      error: 'Unrecognized action: ' + action
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message || 'Unknown POST processing error'
    });
  }
}

/**
 * Sends a single job application email with resume attached
 */
function sendSingleApplication(data) {
  const recipient = (data.to || '').trim();
  if (!recipient || recipient.indexOf('@') === -1) {
    throw new Error('Invalid or missing recipient email address: ' + recipient);
  }

  const roleTitle = data.roleTitle || (data.candidate && data.candidate.title) || CONFIG.defaultRoleTitle;
  const noticePeriod = data.noticePeriod || (data.candidate && data.candidate.noticePeriod) || CONFIG.defaultNoticePeriod;
  const subject = data.subject || ('Application for ' + roleTitle + ' — ' + CONFIG.candidateName);

  // Build text and HTML body
  const textBody = data.textBody || buildDefaultTextBody(roleTitle, noticePeriod);
  const htmlBody = data.htmlBody || buildDefaultHtmlBody(roleTitle, noticePeriod);

  // Retrieve resume PDF
  const resumeBlob = getResumeBlob();

  // Send via GmailApp
  GmailApp.sendEmail(recipient, subject, textBody, {
    name: CONFIG.candidateName,
    htmlBody: htmlBody,
    attachments: [resumeBlob]
  });

  // Log to script properties for deduplication history
  logSentEmail(recipient, subject);

  return {
    success: true,
    to: recipient,
    subject: subject,
    sentAt: new Date().toISOString()
  };
}

/**
 * Sends batch applications with optional delay between emails
 */
function sendBatchApplications(data) {
  const emails = data.emails || [];
  const delayMs = (data.delaySeconds || 3) * 1000;
  const results = [];

  for (let i = 0; i < emails.length; i++) {
    const to = emails[i];
    try {
      const res = sendSingleApplication({
        to: to,
        roleTitle: data.roleTitle,
        noticePeriod: data.noticePeriod,
        subject: data.subject,
        textBody: data.textBody,
        htmlBody: data.htmlBody
      });
      results.push({ email: to, success: true, timestamp: res.sentAt });
    } catch (err) {
      results.push({ email: to, success: false, error: err.message });
    }

    // Delay between emails (except last)
    if (i < emails.length - 1) {
      Utilities.sleep(delayMs);
    }
  }

  return {
    success: true,
    total: emails.length,
    results: results
  };
}

/**
 * Searches Gmail for incoming recruiter replies to application emails
 */
function fetchRecruiterReplies() {
  const query = '(subject:"Application for" OR subject:"Follow-up" OR subject:"Following up") -from:me';
  const threads = GmailApp.search(query, 0, 40);
  const replies = [];

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    const lastMessage = messages[messages.length - 1];
    const fromAddress = lastMessage.getFrom();

    // If last message is NOT from yourself, it is an HR reply!
    if (fromAddress.indexOf(CONFIG.candidateEmail) === -1) {
      replies.push({
        threadId: thread.getId(),
        from: fromAddress,
        subject: thread.getFirstMessageSubject(),
        snippet: lastMessage.getPlainBody().substring(0, 220),
        date: lastMessage.getDate().toISOString(),
        isUnread: thread.isUnread()
      });
    }
  }

  return replies;
}

/**
 * Intelligently retrieves resume PDF by File ID or File Name
 */
function getResumeBlob() {
  const resumeInfo = findResumeFile();
  if (!resumeInfo.found || !resumeInfo.file) {
    throw new Error('Resume PDF not found. Please upload "' + CONFIG.resumeFileName + '" to your Google Drive root.');
  }

  return resumeInfo.file.getAs('application/pdf').setName(CONFIG.resumeFileName);
}

/**
 * Helper to locate the resume file in Google Drive
 */
function findResumeFile() {
  // 1. Check by explicit ID if provided
  if (CONFIG.resumeFileId && CONFIG.resumeFileId.trim()) {
    try {
      const file = DriveApp.getFileById(CONFIG.resumeFileId.trim());
      if (file) {
        return { found: true, file: file, size: file.getSize() };
      }
    } catch (_) { }
  }

  // 2. Check by exact file name
  const exactFiles = DriveApp.getFilesByName(CONFIG.resumeFileName);
  if (exactFiles.hasNext()) {
    const file = exactFiles.next();
    return { found: true, file: file, size: file.getSize() };
  }

  // 3. Fallback: Search for any PDF matching candidate name
  const searchIter = DriveApp.searchFiles('title contains "Himanshu" and mimeType = "application/pdf"');
  if (searchIter.hasNext()) {
    const file = searchIter.next();
    return { found: true, file: file, size: file.getSize() };
  }

  return { found: false, file: null, size: 0 };
}

/**
 * Records sent email in Script Properties for tracking
 */
function logSentEmail(email, subject) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'sent_' + email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    props.setProperty(key, JSON.stringify({
      email: email,
      subject: subject,
      sentAt: new Date().toISOString()
    }));
  } catch (_) { }
}

/**
 * Builds standard plain text body with complete production projects
 */
function buildDefaultTextBody(roleTitle, noticePeriod) {
  var lines = [
    'Dear Hiring Team,',
    '',
    'I am actively looking for new opportunities and writing to share my resume for a ' + roleTitle + ' position with your organization (open to Onsite, Hybrid, or Remote roles — ' + noticePeriod + ').',
    '',
    'I am a Full Stack Developer with 3.5+ years of hands-on production experience building and maintaining web, desktop, and mobile applications across the MEAN and MERN stacks at Rao Information Technology (February 2023 – Present). I have delivered 7+ production client and company products end-to-end from architecture to deployment.',
    '',
    'Key Highlights & Availability:',
    '• Notice Period: ' + noticePeriod + ' (Actively looking for new opportunities)',
    '• MEAN & MERN Stack: ' + CONFIG.skillsSummary.meanMern,
    '• Core Production Stack: ' + CONFIG.skillsSummary.coreProduction,
    '• Backend, Real-Time & AI: ' + CONFIG.skillsSummary.backendAndData,
    '• Frontend & Mobile: ' + CONFIG.skillsSummary.frontendAndMobile,
    '• Cloud & DevOps: ' + CONFIG.skillsSummary.deployment,
    '',
    'Key Production Projects:'
  ];

  for (var i = 0; i < CONFIG.projectsSummary.length; i++) {
    lines.push('• ' + CONFIG.projectsSummary[i]);
  }

  lines.push('');
  lines.push('Education:');
  lines.push('• ' + CONFIG.education);
  lines.push('');
  lines.push('I have attached my resume (' + CONFIG.resumeFileName + ') for your consideration. You can also explore my live work and code repositories below:');
  lines.push('• Portfolio: ' + CONFIG.portfolio);
  lines.push('• GitHub: ' + CONFIG.github);
  lines.push('• LinkedIn: ' + CONFIG.linkedin);
  lines.push('');
  lines.push('Thank you for your time and consideration. I would welcome the opportunity to connect and discuss how I can contribute to your engineering team.');
  lines.push('');
  lines.push('Best regards,');
  lines.push(CONFIG.candidateName);
  lines.push(roleTitle);
  lines.push('Notice Period: ' + noticePeriod + ' (Actively Looking)');
  lines.push('Phone: ' + CONFIG.phone + ' | Email: ' + CONFIG.candidateEmail);
  lines.push('Location: Rajkot, Gujarat, India');

  return lines.join('\n');
}

/**
 * Builds modern, clean HTML email body for high recruiter response rates
 */
function buildDefaultHtmlBody(roleTitle, noticePeriod) {
  var projectsHtml = '';
  for (var i = 0; i < CONFIG.projectsSummary.length; i++) {
    projectsHtml += '<li style="margin-bottom: 4px;">' + CONFIG.projectsSummary[i] + '</li>';
  }

  return [
    '<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 680px;">',
    '  <p>Dear <strong>Hiring Team</strong>,</p>',
    '  <p>',
    '    I am <strong>actively looking for new opportunities</strong> and writing to share my profile and resume for a <strong>' + roleTitle + '</strong> opportunity with your organization',
    '    (available for Onsite, Hybrid, or Remote roles &mdash; <strong style="color: #16a34a;">' + noticePeriod + '</strong>).',
    '  </p>',
    '  <p>',
    '    I am a Full Stack Developer with <strong>3.5+ years of hands-on production experience</strong> building and maintaining web, desktop, and mobile products using the <strong>MEAN and MERN stacks</strong> at Rao Information Technology (February 2023 &ndash; Present), where I have delivered 7+ client and internal products end-to-end.',
    '  </p>',
    '  <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 14px; margin: 16px 0; border-radius: 4px;">',
    '    <strong>Notice Period &amp; Availability:</strong> Actively looking for job opportunities &bull; <strong style="color: #15803d;">' + noticePeriod + '</strong>',
    '  </div>',
    '  <p style="margin-bottom: 6px;"><strong>Technical Skills Summary:</strong></p>',
    '  <ul style="margin-top: 4px; padding-left: 20px;">',
    '    <li><strong>MEAN &amp; MERN Stack:</strong> ' + CONFIG.skillsSummary.meanMern + '</li>',
    '    <li><strong>Core Production Stack:</strong> ' + CONFIG.skillsSummary.coreProduction + '</li>',
    '    <li><strong>Backend, Databases &amp; AI:</strong> ' + CONFIG.skillsSummary.backendAndData + '</li>',
    '    <li><strong>Frontend &amp; Mobile:</strong> ' + CONFIG.skillsSummary.frontendAndMobile + '</li>',
    '    <li><strong>Deployment &amp; Tooling:</strong> ' + CONFIG.skillsSummary.deployment + '</li>',
    '  </ul>',
    '  <p style="margin-bottom: 6px;"><strong>Key Production Projects:</strong></p>',
    '  <ul style="margin-top: 4px; padding-left: 20px;">' + projectsHtml + '</ul>',
    '  <p><strong>Education:</strong> ' + CONFIG.education + '</p>',
    '  <p>Please find my resume (<strong>' + CONFIG.resumeFileName + '</strong>) attached. You can also view my live projects and code here:</p>',
    '  <ul style="margin-top: 4px; padding-left: 20px;">',
    '    <li><strong>Portfolio:</strong> <a href="' + CONFIG.portfolio + '">' + CONFIG.portfolio + '</a></li>',
    '    <li><strong>GitHub:</strong> <a href="' + CONFIG.github + '">' + CONFIG.github + '</a></li>',
    '    <li><strong>LinkedIn:</strong> <a href="' + CONFIG.linkedin + '">' + CONFIG.linkedin + '</a></li>',
    '  </ul>',
    '  <p>Thank you for your time and consideration. I look forward to hearing from you.</p>',
    '  <p style="margin-top: 20px;">',
    '    Best regards,<br/>',
    '    <strong>' + CONFIG.candidateName + '</strong><br/>',
    '    ' + roleTitle + '<br/>',
    '    <span style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 4px; margin-bottom: 4px;">Notice Period: ' + noticePeriod + '</span><br/>',
    '    Phone: <a href="tel:' + CONFIG.phone.replace(/[^0-9+]/g, '') + '">' + CONFIG.phone + '</a> | Email: <a href="mailto:' + CONFIG.candidateEmail + '">' + CONFIG.candidateEmail + '</a><br/>',
    '    Rajkot, Gujarat, India',
    '  </p>',
    '</div>'
  ].join('\n');
}

/**
 * Helper to return clean JSON HTTP responses
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================================
 * TEST FUNCTION: Click "Run" on this function inside Google Apps Script
 * to send 1 test email to yourself and verify everything is working!
 * ============================================================================
 */
function testSendToMyself() {
  Logger.log('Starting self-test...');

  const resumeInfo = findResumeFile();
  if (!resumeInfo.found) {
    Logger.log('ERROR: Resume "' + CONFIG.resumeFileName + '" was not found in your Google Drive!');
    Logger.log('Please upload "Himanshu Chauhan.pdf" to https://drive.google.com first.');
    return;
  }

  Logger.log('Resume found! File size: ' + Math.round(resumeInfo.size / 1024) + ' KB');

  const testResult = sendSingleApplication({
    to: CONFIG.candidateEmail,
    roleTitle: 'Full Stack Developer',
    noticePeriod: '15 Days Notice Period',
    subject: 'TEST: Application for Full Stack Developer — Himanshu A. Chauhan'
  });

  Logger.log('SUCCESS! Test email sent to: ' + CONFIG.candidateEmail);
  Logger.log('Check your Gmail inbox. Result: ' + JSON.stringify(testResult));
}
