import { Link } from 'react-router-dom';
import { AnimatedGroup, InView, TextEffect } from '../motion';

const CHECKS = [
  ['01', 'Differential fuzzing', 'Your function and a trusted reference receive the same generated inputs. Any difference in output is a finding. Edge cases such as empty, single element and duplicates run first.'],
  ['02', 'Shrinking', 'A failing input is cut down by removing chunks and simplifying values until nothing more can be removed. You get the smallest case that still fails, not a 14 element wall of numbers.'],
  ['03', 'Property checks', 'The call must not mutate the caller’s data and must be deterministic. Optional checks cover sorted output, permutation of the input, preserved length and idempotence.'],
  ['04', 'Complexity probe', 'Runtime is measured from 250 up to 8000 elements and a log-log slope is fitted. Claim O(n), measure n squared, and it is reported even when every output is correct.'],
  ['05', 'Isolation', 'Code runs inside QuickJS compiled to WebAssembly, with a memory cap, a stack cap and an interrupt deadline. It cannot reach the server, the file system or the network.'],
  ['06', 'Regression tests', 'Every minimal counterexample can be exported as a Jest test, so the bug you found stays fixed after the rewrite.'],
];

const STEPS = [
  ['Load', 'Your code and the reference are evaluated in separate sandboxes.'],
  ['Edge cases', 'Hand-picked inputs for the chosen shape run first.'],
  ['Fuzz', 'Seeded random inputs of growing size are compared against the reference and the property list.'],
  ['Shrink', 'The first failure of each kind is minimised.'],
  ['Probe', 'Runtime is timed at growing sizes and compared with your claim.'],
  ['Score', 'Findings are weighted into a 0 to 100 trust score with the oracle confidence stated.'],
];

const LIMITS = [
  'One JavaScript function per audit. Inputs and outputs must be JSON-like.',
  'Five input shapes today: integer array, sorted array with a target, single integer, string, and intervals.',
  'Correctness needs an oracle. Without a reference or an output property the score is capped at 85 and says so.',
  'Timing is measured inside QuickJS. Compare growth rates, not absolute milliseconds.',
];

export default function Landing() {
  return (
    <>
      <section className="hero">
        <p className="kicker">Audit tool for AI-written JavaScript</p>
        <TextEffect as="h1" per="word" preset="fade-in-blur" className="display">Find the input that breaks AI-written code.</TextEffect>
        <InView className="hero-sub" delay={0.35}>
          <p>Paste a function and a trusted reference. BluffCheck runs both in an isolated sandbox, fuzzes them with generated inputs, shrinks every disagreement to the smallest case, and measures how runtime grows with input size.</p>
        </InView>
        <InView className="hero-cta" delay={0.5}>
          <Link className="btn" to="/audit">Audit a function</Link>
          <Link className="btn alt" to="/audit?example=binary-search">Open the binarySearch example</Link>
        </InView>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <span key={k}>DIFFERENTIAL FUZZING <i /> INPUT SHRINKING <i /> PROPERTY CHECKS <i /> COMPLEXITY PROBE <i /> WASM SANDBOX <i /> REGRESSION TESTS <i /></span>
          ))}
        </div>
      </div>

      <section className="sec">
        <InView><h2>What it checks</h2></InView>
        <AnimatedGroup className="grid-3" itemClassName="grid-item" stagger={0.09}>
          {CHECKS.map(([n, t, d]) => (
            <article className="card" key={n}>
              <span className="num">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </AnimatedGroup>
      </section>

      <section className="sec split">
        <InView>
          <h2>What a finding looks like</h2>
          <p className="lead">This is the output of the built-in <code>binarySearch</code> example, where an AI-style loop condition skips the last candidate. The call is the smallest input the shrinker could reach.</p>
        </InView>
        <InView delay={0.1}>
          <div className="card terminal" role="img" aria-label="Example finding: binarySearch of array containing 1 and target 1 returned minus 1 but 0 was expected">
            <div className="tag crit">CRITICAL</div>
            <p className="t-title">Wrong output vs. reference</p>
            <pre>{`binarySearch([1], 1)\n\nexpected   0\nactual    -1`}</pre>
            <p className="t-note">Score 55 of 100. Verdict: do not ship.</p>
          </div>
        </InView>
      </section>

      <section className="sec">
        <InView><h2>The pipeline</h2></InView>
        <AnimatedGroup as="ol" className="steps" itemClassName="step" preset="slide" stagger={0.07}>
          {STEPS.map(([t, d], i) => (
            <li key={t}><span className="num">{String(i + 1).padStart(2, '0')}</span><strong>{t}</strong><span>{d}</span></li>
          ))}
        </AnimatedGroup>
      </section>

      <section className="sec split">
        <InView>
          <h2>Limits, stated plainly</h2>
          <p className="lead">A passing audit raises confidence. It does not prove a function correct.</p>
        </InView>
        <InView delay={0.1}>
          <ul className="limits">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
        </InView>
      </section>

      <section className="sec cta-band">
        <InView>
          <h2>Check the next function an AI hands you.</h2>
          <Link className="btn" to="/audit">Audit a function</Link>
        </InView>
      </section>
    </>
  );
}
