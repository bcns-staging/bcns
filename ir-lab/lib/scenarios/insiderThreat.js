// A departing employee exfiltrating proprietary code and customer data --
// centers on the tension between acting fast and preserving evidence
// properly, and HR/legal due process for termination-for-cause versus a
// quiet, undocumented parting of ways.
module.exports = {
  id: 'insider-threat',
  title: 'Insider Threat: Vantage Systems',
  tagline: 'A departing engineer has uploaded 40GB to a personal cloud account in three days.',
  briefing: "You're the Incident Commander at Vantage Systems. DLP just flagged Marcus Reyes — a senior engineer who gave two weeks' notice yesterday — for uploading 40GB to a personal Dropbox account over the last three days, including what looks like core proprietary source code and a customer export. He's at his desk right now. Every decision from here balances stopping the exfiltration against preserving evidence and following a legally sound process for what happens to Marcus next.",
  domainsInvolved: ['security', 'it', 'hr', 'legal', 'exec'],
  startNodeId: 'n1_alert',
  nodes: {
    n1_alert: {
      id: 'n1_alert',
      phase: 'Detection & Analysis',
      situation: "DLP flags Marcus Reyes, a senior engineer who gave two weeks' notice yesterday, for uploading 40GB of data to a personal Dropbox account over the last three days — including what looks like the core recommendation-engine source code and a customer contact export. He's at his desk right now; his badge shows he's in the building.",
      choices: [
        {
          id: 'a', label: 'Immediately suspend his access and have security escort him out, looping in HR/legal as it happens', domains: ['security', 'it'],
          next: 'n2a_immediate_lockout', effects: { containment: 20, compliance: -10 },
          feedback: 'Access is cut and Marcus is escorted out within minutes — the exfiltration stops cold. It also happens before HR or legal had a chance to build a documented record, which matters for what comes next.',
          doctrineNote: 'Stopping an active exfiltration takes priority technically, but employment actions taken before HR/legal have a documented basis create real legal risk of their own (wrongful suspension, retaliation claims) — speed and process aren’t opposed, they just need to happen together, not one before the other.',
        },
        {
          id: 'b', label: 'Quietly monitor for now, and loop in HR and legal before taking any visible action', domains: ['hr', 'legal'],
          next: 'n2b_quiet_investigation', effects: { containment: -10, compliance: 15 },
          feedback: "HR and legal start building a proper documented case immediately. Marcus's access stays live a bit longer while that happens, which has its own cost.",
          doctrineNote: 'Building a documented, legally defensible case before taking employment action is genuinely correct practice — the tradeoff being made explicit here is that it costs some continued technical exposure, which the next decision has to manage.',
        },
        {
          id: 'c', label: 'Go confront him directly yourself, right now, and ask what’s going on', domains: ['exec'],
          next: 'n2c_direct_confront', effects: { containment: -15, compliance: -15 },
          feedback: 'Marcus denies everything and gets defensive. He also now knows he’s been noticed, with his laptop and access both still fully in his hands.',
          doctrineNote: 'Direct confrontation before any containment or evidence preservation gives a suspected insider both warning and continued access simultaneously — of the three options here, this is the one most likely to let someone destroy evidence or accelerate exfiltration before anyone else has acted.',
        },
      ],
    },

    n2a_immediate_lockout: {
      id: 'n2a_immediate_lockout',
      phase: 'Containment, Eradication & Recovery',
      situation: "Access is cut immediately. Marcus is visibly upset in the lobby, loudly asking what's going on in front of other employees, and is now asking for a lawyer before saying anything else. HR flags that because you acted before they were looped in, there's no documented cause on file yet — just an access log.",
      choices: [
        {
          id: 'a', label: 'Pause here — bring in HR/legal now to properly document cause before proceeding further', domains: ['hr', 'legal'],
          next: 'n3_documented_response', effects: { compliance: 15 },
          feedback: 'HR and legal build the documented record after the fact — later than ideal, but before any further employment action happens without it.',
          doctrineNote: 'This is a recoverable sequencing mistake: pausing to build the record properly, even after acting first on containment, is far better than continuing to act without one. The lesson isn’t "never act fast," it’s "loop in HR/legal in the same breath as acting, not after."',
        },
        {
          id: 'b', label: 'Proceed straight to termination for cause based on the DLP alert alone', domains: ['exec'],
          next: 'premature_termination', effects: { compliance: -25, financial: -15 },
          feedback: 'Termination happens the same day, on the strength of an access log alone, with no HR-documented investigation. Marcus’s lawyer sends a wrongful-termination letter within the week, and Vantage’s own legal team confirms the file is thin.',
          doctrineNote: 'A DLP alert is a strong indicator, not a completed investigation. Terminating for cause without HR building a documented, defensible record first is exactly the gap employment litigation is built to find — the underlying suspicion may be entirely correct and the termination still be legally indefensible.',
        },
      ],
    },

    n2b_quiet_investigation: {
      id: 'n2b_quiet_investigation',
      phase: 'Containment, Eradication & Recovery',
      situation: "HR and legal build a documented case over the next day: the DLP logs, his resignation timing, and confirmation the exported code matches proprietary source. Meanwhile Marcus's access remains active for one more day, during which forensics shows he attempted — and failed, due to an unrelated network hiccup — one more large export.",
      choices: [
        {
          id: 'a', label: 'Now execute a coordinated access suspension with full documentation already in place', domains: ['security', 'hr', 'legal'],
          next: 'n3_documented_response', effects: { containment: 15, compliance: 10 },
          feedback: 'Access is cut with a complete, defensible record already built — the coordinated version of what the "act first" path had to assemble after the fact.',
          doctrineNote: 'This is the sequencing this scenario is built to reward: technical containment and HR/legal documentation finishing together, so the suspension and the case for it land at the same moment instead of one waiting on the other.',
        },
        {
          id: 'b', label: 'Continue monitoring further, to see if he attempts to exfiltrate more before acting', domains: ['security'],
          next: 'extended_exposure', effects: { containment: -20, financial: -10 },
          feedback: 'The case file is thorough. It is also now sitting alongside a second near-miss export attempt that a completed, unexecuted suspension plan did nothing to prevent.',
          doctrineNote: 'Once a documented case is actually complete, there is no doctrinal reason to keep exposure open further — "let’s see what else he tries" converts a finished investigation into an unforced continuation of the exact risk the investigation was meant to end.',
        },
      ],
    },

    n2c_direct_confront: {
      id: 'n2c_direct_confront',
      phase: 'Containment, Eradication & Recovery',
      situation: 'Marcus denies everything and becomes defensive. By the time security is looped in twenty minutes later, his laptop shows signs he ran a disk-wipe utility on his personal downloads folder. Whatever evidence existed there is gone.',
      choices: [
        {
          id: 'a', label: 'Immediately preserve what evidence remains (server-side logs, DLP records) and bring in HR/legal/forensics now', domains: ['security', 'legal', 'hr'],
          next: 'n3_documented_response', effects: { containment: 5, compliance: -5 },
          feedback: 'Server-side logs and DLP records — the parts of the evidence trail Marcus never had access to delete — are preserved and prove sufficient on their own, though the case is thinner than it would have been.',
          doctrineNote: 'Chain-of-custody doctrine exists precisely because endpoint evidence is always at risk once a subject is aware they’re suspected — server-side and DLP-side logs, outside the subject’s control, are what actually survives a confrontation like this one. This is a recoverable mistake, not a fatal one, but it illustrates why confrontation should never come before evidence preservation.',
        },
        {
          id: 'b', label: 'Let him finish his notice period normally since direct confrontation didn’t get anywhere', domains: ['exec'],
          next: 'unresolved_exposure', effects: { containment: -30, compliance: -25, financial: -20 },
          feedback: 'Marcus works his final two weeks with essentially unrestricted access, now fully aware he’s under suspicion, with every incentive to finish whatever he started before his last day.',
          doctrineNote: 'A failed confrontation is a strong signal to escalate containment immediately, not to default back to business as usual — a tipped-off insider with two more weeks of standing access is close to the worst position this scenario can reach.',
        },
      ],
    },

    n3_documented_response: {
      id: 'n3_documented_response',
      phase: 'Containment, Eradication & Recovery',
      situation: 'Access is fully suspended, whatever evidence survived is documented and preserved with a defensible chain of custody, and HR/legal have a coordinated plan. The core decision left: how do you handle the termination and the legal response to the data theft itself?',
      choices: [
        {
          id: 'a', label: 'Terminate for cause with full documentation, and pursue a civil claim to recover and prevent use of the stolen IP', domains: ['legal', 'hr', 'exec'],
          next: 'pursued_properly', effects: { compliance: 20, financial: 5, reputation: 5 },
          feedback: 'Termination for cause proceeds on a well-documented record. Legal files for a civil injunction barring Marcus and any future employer from using the stolen source code, backed by the preserved evidence trail.',
          doctrineNote: 'A documented case is what makes both halves of this possible: defensible termination and an enforceable civil claim. Neither is realistic without the evidence-preservation and HR-coordination steps that got the response here.',
        },
        {
          id: 'b', label: 'Let him resign as originally planned in two weeks without termination for cause, to avoid a legal fight, and quietly accept the loss', domains: ['exec'],
          next: 'quiet_settlement', effects: { compliance: -5, financial: -10 },
          feedback: 'Marcus finishes his notice and leaves on paper as a normal resignation. No civil claim is filed, and no legal mechanism exists to prevent the stolen code from being used at his next job.',
          doctrineNote: 'Avoiding a legal fight is a legitimate business tradeoff some organizations make deliberately — the cost being made explicit here is that a documented case strong enough to support termination-for-cause was also strong enough to support a civil claim, and choosing not to pursue either leaves the stolen IP with no legal constraint on its use.',
        },
      ],
    },

    premature_termination: {
      id: 'premature_termination', ending: true, phase: 'Post-Incident Activity',
      situation: 'Termination happened on an access log alone, with no documented investigation behind it.',
      endingId: 'premature_termination', endingTone: 'bad',
      endingSummary: "The exfiltration was stopped, but the termination itself is now the company's problem: a wrongful-termination claim backed by the fact that no HR-documented cause exists beyond a raw access log. The postmortem's finding isn't that Marcus was wrongly suspected — the DLP data was real — it's that acting on suspicion without the process to back it up traded a clean data-theft case for a messy employment dispute.",
    },
    extended_exposure: {
      id: 'extended_exposure', ending: true, phase: 'Post-Incident Activity',
      situation: 'A complete case sat unexecuted while exposure continued.',
      endingId: 'extended_exposure', endingTone: 'bad',
      endingSummary: 'The documented case was solid, but it kept sitting on the shelf while access stayed open "to see what else he tries." A second near-miss export happened during exactly that window. The postmortem is direct: once a case is complete enough to act on, delaying the action itself becomes the risk, not a way of managing it.',
    },
    unresolved_exposure: {
      id: 'unresolved_exposure', ending: true, phase: 'Post-Incident Activity',
      situation: 'A tipped-off insider finished his notice period with standing access intact.',
      endingId: 'unresolved_exposure', endingTone: 'bad',
      endingSummary: "Marcus worked his full two weeks, fully aware he was under suspicion, with access never meaningfully restricted. What could have been contained on day one instead had fourteen more days to develop, entirely because a failed confrontation was followed by a return to normal instead of an escalation. This is the postmortem's clearest finding: a tipped-off subject with standing access is a worse position than the one you started in.",
    },
    pursued_properly: {
      id: 'pursued_properly', ending: true, phase: 'Post-Incident Activity',
      situation: 'Documented termination, plus an enforceable civil claim over the stolen code.',
      endingId: 'pursued_properly', endingTone: 'good',
      endingSummary: 'Containment was fast, evidence was preserved with a clean chain of custody, HR and legal built a genuinely defensible record, and the resulting case supported both a for-cause termination and a civil injunction over the stolen source code. This is the shape the incident response plan is meant to produce: technical, HR, and legal workstreams landing together instead of racing each other.',
    },
    quiet_settlement: {
      id: 'quiet_settlement', ending: true, phase: 'Post-Incident Activity',
      situation: 'A documented case, built and then set aside rather than pursued.',
      endingId: 'quiet_settlement', endingTone: 'mixed',
      endingSummary: "The investigation was done right, the evidence was solid — and then nothing was done with it. Marcus left on paper as a normal resignation, with no legal constraint on using the stolen code elsewhere. It's a real, sometimes deliberate business choice to avoid a legal fight, but the postmortem notes the cost plainly: a case strong enough to support a civil claim went unused, and the stolen IP left with no mechanism to stop what happens to it next.",
    },
  },
};
