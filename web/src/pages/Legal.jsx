import { Link } from 'react-router-dom';
import { InView, TextEffect } from '../motion';
import { site } from '../site.config.js';

const Contact = () => (
  <p>{site.contactEmail ? <>Questions or deletion requests: <a href={'mailto:' + site.contactEmail}>{site.contactEmail}</a>.</> : 'Questions or deletion requests: open an issue on the project repository, or contact the person who operates this deployment.'}</p>
);

export function Privacy() {
  return (
    <article className="legal">
      <TextEffect as="h1" per="word" className="page-title">Privacy policy</TextEffect>
      <p className="muted">Last updated {site.updated}</p>
      <InView>
        <h2>What this service stores</h2>
        <ul>
          <li>The code and reference code you submit, the settings you chose, and the audit result. This is needed to run the audit, show you the result and let you share it.</li>
          <li>A random identifier created in your browser (localStorage key <code>bluffcheck_client</code>). It is sent with your requests so the History page can list your own audits. It is not linked to your name or email.</li>
        </ul>
        <h2>What it does not do</h2>
        <ul>
          <li>No accounts, no cookies, no analytics, no advertising and no third party scripts or fonts. Everything the page loads comes from this server.</li>
          <li>Your IP address is held in memory for a few minutes to enforce rate limits. It is not written to the database.</li>
        </ul>
        <h2>Sharing</h2>
        <p>Every audit has a random link. Anyone who has the link can view the code, reference and result. Do not paste secrets, credentials or code you are not allowed to share.</p>
        <h2>How your code is run</h2>
        <p>Submitted code is executed in a QuickJS interpreter compiled to WebAssembly, with memory, stack and time limits. It has no access to the file system, network or server process.</p>
        <h2>Retention and deletion</h2>
        <p>Audits are deleted automatically {site.retentionDays} days after they are created. You can delete one earlier from the <Link to="/history">History</Link> page. Backups made by the hosting provider may persist for a short time.</p>
        <h2>Hosting</h2>
        <p>The hosting provider may keep standard server logs such as IP address and request time under its own policy.</p>
        <h2>Contact</h2>
        <Contact />
      </InView>
    </article>
  );
}

export function Terms() {
  return (
    <article className="legal">
      <TextEffect as="h1" per="word" className="page-title">Terms of use</TextEffect>
      <p className="muted">Last updated {site.updated}</p>
      <InView>
        <h2>The service</h2>
        <p>{site.name} runs automated checks on JavaScript functions you submit. It is provided as is, without warranty of any kind.</p>
        <h2>Results are evidence, not proof</h2>
        <p>Fuzzing, property checks and timing can reveal bugs. A clean result does not prove that code is correct, secure or fast enough. You are responsible for how you use the output.</p>
        <h2>Acceptable use</h2>
        <ul>
          <li>Do not submit code or data you have no right to share, or that is unlawful.</li>
          <li>Do not try to escape the sandbox, probe the server, or use the service to attack others.</li>
          <li>Do not send automated traffic beyond the posted rate limits.</li>
        </ul>
        <h2>Your content</h2>
        <p>You keep ownership of the code you submit. You allow the service to process and store it for the retention period so it can provide the audit and the share link.</p>
        <h2>Availability and changes</h2>
        <p>The service may be limited, changed or stopped at any time. Audits may be removed at the end of the retention period or earlier if needed to keep the service running.</p>
        <h2>Liability</h2>
        <p>To the extent the law allows, the operator is not liable for losses arising from use of the service or reliance on its results.</p>
        <h2>Contact</h2>
        <Contact />
        <p>See also the <Link to="/privacy">privacy policy</Link>.</p>
      </InView>
    </article>
  );
}

export function NotFound() {
  return (
    <div className="workbench">
      <TextEffect as="h1" per="word" className="page-title">Page not found</TextEffect>
      <Link className="btn" to="/">Back to the start</Link>
    </div>
  );
}
