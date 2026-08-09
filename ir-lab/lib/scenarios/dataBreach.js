// Customer PII exfiltration at a SaaS company with EU and California
// customers -- centers on GDPR's 72-hour notification clock, CCPA's
// "without unreasonable delay" standard, and the gap between disclosing
// enough versus disclosing honestly.
module.exports = {
  id: 'data-breach',
  title: 'Data Breach: Northlake Analytics',
  tagline: 'A service account has been quietly reading the entire customer table for six days.',
  briefing: "You're the Incident Commander at Northlake Analytics, a SaaS company with customers across the EU and California. A database engineer just flagged unusual query patterns — a service account reading far more of the customer table than it should. If it's what it looks like, roughly 2 million records may already be gone, and multiple notification-deadline clocks are about to start running whether you're ready or not.",
  domainsInvolved: ['security', 'it', 'legal', 'pr', 'exec'],
  startNodeId: 'n1_detection',
  nodes: {
    n1_detection: {
      id: 'n1_detection',
      phase: 'Detection & Analysis',
      situation: "3:40 PM. A database engineer notices unusual query patterns against the customer table — reads spanning the entire dataset, run from an application service account that's never queried more than a few thousand rows at once. Early analysis suggests this has been happening intermittently for six days. If it's what it looks like, roughly 2 million customer records — emails, hashed passwords, partial billing addresses — may have been exfiltrated.",
      choices: [
        {
          id: 'a', label: "Immediately revoke the service account's credentials and kill its active sessions", domains: ['security', 'it'],
          next: 'n2a_stopped_fast', effects: { containment: 20 },
          feedback: 'The account is cut off within minutes. Whatever access the attacker had through this credential ends now, whatever the final tally of records touched turns out to be.',
          doctrineNote: 'SP 800-61 containment doctrine is unambiguous here: a confirmed unauthorized access channel gets closed immediately, full stop. There is no analysis that justifies leaving a live exfiltration channel open longer than it takes to revoke it.',
        },
        {
          id: 'b', label: 'Monitor the account quietly for another day to gather more evidence on the attacker’s methods before acting', domains: ['security'],
          next: 'n2b_stopped_slow', effects: { containment: -15 },
          feedback: 'You get a richer picture of the attacker’s query patterns and timing. You also get another full day of exfiltration on top of the six you already had.',
          doctrineNote: 'Intelligence-gathering-by-continued-exposure is a real technique in some controlled scenarios (e.g. an active law-enforcement operation), but it requires an explicit, deliberate authorization — it is not the default response to a confirmed active data exfiltration, and every additional hour directly increases the eventual notification scope.',
        },
        {
          id: 'c', label: 'Loop in legal immediately to start the compliance clock analysis before touching anything technical', domains: ['legal', 'exec'],
          next: 'n2c_legal_first', effects: { compliance: 10, containment: -10 },
          feedback: 'Legal maps out exactly which notification clocks are running and when they started. The service account, meanwhile, still has live read access to the customer table while this conversation happens.',
          doctrineNote: 'Understanding your notification obligations early is genuinely valuable — but, as with the ransomware case, legal analysis and technical containment are parallel workstreams, not sequential ones. The exfiltration channel doesn’t pause for the legal team to finish mapping deadlines.',
        },
      ],
    },

    n2a_stopped_fast: {
      id: 'n2a_stopped_fast',
      phase: 'Containment, Eradication & Recovery',
      situation: "Exfiltration stops immediately. Forensics confirms the access window was 6 days, roughly 2.1 million records touched. The company has EU and California customers, which means GDPR's 72-hour supervisory-authority notification clock and CCPA's 'without unreasonable delay' standard are both running from the moment of discovery — today.",
      choices: [
        {
          id: 'a', label: 'Start the GDPR/CCPA notification process in parallel with the forensic investigation, not after it', domains: ['legal', 'exec'],
          next: 'n3_notification_track', effects: { compliance: 20 },
          feedback: 'Legal begins drafting the regulatory notification immediately, updating it as forensics confirms more detail, rather than waiting for a final report that doesn’t exist yet.',
          doctrineNote: "GDPR's 72-hour window is famously tight specifically because it's designed to force notification before an investigation is complete. Regulators explicitly expect an initial notification with best-available information, followed by updates — not a single, fully-resolved report filed late.",
        },
        {
          id: 'b', label: 'Wait until the forensic investigation is fully complete before notifying anyone, to have a complete story', domains: ['legal'],
          next: 'n3b_delayed_notice', effects: { compliance: -20 },
          feedback: 'The investigation is thorough. It also takes ten days — a week past the 72-hour window most of your affected customers’ notifications were legally required to beat.',
          doctrineNote: 'This is the most common real-world GDPR notification failure: treating "complete and accurate" as a prerequisite for the first filing, when the regulation explicitly only requires it for the first filing to be timely and best-effort, with amendments allowed as facts develop.',
        },
      ],
    },

    n2b_stopped_slow: {
      id: 'n2b_stopped_slow',
      phase: 'Containment, Eradication & Recovery',
      situation: 'A day of additional monitoring produces useful attacker-methodology data — but also a day of additional exfiltration. The total window is now 7 days, and forensics estimates closer to 2.4 million records touched, including a newly-discovered batch with partial payment card data the earlier estimate missed.',
      choices: [
        {
          id: 'a', label: 'Move to full technical containment and start the compliance workflow now', domains: ['security', 'legal'],
          next: 'n3_notification_track', effects: { containment: 10, compliance: 10 },
          feedback: 'You cut off access and start the notification process a day later than you could have, with a larger confirmed record count and a payment-card angle that widens the regulatory scope.',
          doctrineNote: 'The right move is still the right move, just later — this path illustrates that a delayed containment decision doesn’t just cost technical exposure time, it can materially change *what* has to be disclosed, since a day of continued access surfaced payment data the initial estimate missed entirely.',
        },
        {
          id: 'b', label: 'Continue the extended monitoring approach a while longer to fully map the attacker’s infrastructure', domains: ['security'],
          next: 'overexposed_ending', effects: { containment: -25, compliance: -15, financial: -15 },
          feedback: 'The infrastructure mapping is impressively thorough. It is also now built on top of nine total days of live, confirmed, unauthorized access to customer payment data that nobody in legal or executive leadership approved continuing.',
          doctrineNote: 'There is no version of incident response doctrine that endorses extending a confirmed active exfiltration indefinitely for intelligence value. Whatever forensic insight this produces, it does not offset the compounding legal exposure of every additional day of unauthorized access to regulated data.',
        },
      ],
    },

    n2c_legal_first: {
      id: 'n2c_legal_first',
      phase: 'Containment, Eradication & Recovery',
      situation: 'Legal has a clear notification-timeline plan. Meanwhile the service account is still active and still has read access to the customer table.',
      choices: [
        {
          id: 'a', label: 'Now move to also cut technical access immediately, in parallel', domains: ['security', 'it'],
          next: 'n3_notification_track', effects: { containment: 15, compliance: 5 },
          feedback: 'Technical containment finally happens alongside the legal planning that already started. The account is cut off with a clear compliance runway already mapped out.',
          doctrineNote: 'This is the corrected version of the same lesson from the ransomware scenario: legal and technical response are meant to run together, not one gating the other. Better late than not at all — every hour the account stayed active after this point would have been avoidable.',
        },
        {
          id: 'b', label: 'Continue building the legal case before touching the account, to avoid any appearance of destroying evidence', domains: ['legal'],
          next: 'n2b_stopped_slow', effects: { containment: -10 },
          feedback: 'The concern about evidence preservation is legitimate in principle, but revoking a credential doesn’t destroy forensic evidence — logs and access records persist regardless. The account stays active for another day on a misapplied caution.',
          doctrineNote: 'Evidence preservation and access revocation are not in tension: forensic images, logs, and audit trails survive a credential revocation just fine. Conflating "stop the bleeding" with "destroy the evidence" is a common but incorrect reason to delay containment.',
        },
      ],
    },

    n3_notification_track: {
      id: 'n3_notification_track',
      phase: 'Containment, Eradication & Recovery',
      situation: 'Technical containment is done, legal has a notification plan, and the compliance clock is running. Now the real question: how much do you tell customers up front, and how do you handle the PR fallout that’s about to start regardless?',
      choices: [
        {
          id: 'a', label: 'Publish a full, specific breach notice — what was taken, how many affected, concrete remediation steps — to regulators and customers simultaneously', domains: ['legal', 'pr', 'exec'],
          next: 'transparent_breach_handled', effects: { compliance: 15, reputation: 10 },
          feedback: 'The notice goes out with real specifics: what data, how many people, what Northlake is doing about it, and what affected customers should do themselves. It is, unavoidably, bad news covered by the press — but it is Northlake’s own account of its own breach.',
          doctrineNote: 'Specific, simultaneous disclosure to regulators and affected individuals is what both GDPR and CCPA are actually built around, and it is also, empirically, what most reduces follow-on reputational damage — vague or delayed disclosures consistently generate worse press coverage than direct ones, because the vagueness itself becomes the story.',
        },
        {
          id: 'b', label: 'Publish a vague, minimal notice to regulators and stay quiet publicly for now to avoid panic', domains: ['legal', 'pr'],
          next: 'n4_minimal_disclosure', effects: { compliance: -10, reputation: -5 },
          feedback: 'The regulatory filing is technically compliant but light on detail, and there’s no public statement. It buys a few days of quiet.',
          doctrineNote: 'Minimal-but-technically-compliant notifications satisfy the letter of the law while often failing its intent (informing affected people well enough to protect themselves), and they create real risk if a more detailed account of the same breach reaches the public through another channel first.',
        },
      ],
    },

    n4_minimal_disclosure: {
      id: 'n4_minimal_disclosure',
      phase: 'Post-Incident Activity',
      situation: 'A tech journalist, tipped off by an affected customer comparing notes online, publishes a story with more specific — and more alarming — details than the company’s own notice contained. Northlake is now reacting to someone else’s version of its own breach.',
      choices: [
        {
          id: 'a', label: 'Immediately follow up with the full, specific disclosure you should have led with', domains: ['legal', 'pr', 'exec'],
          next: 'late_transparency', effects: { reputation: 5, compliance: 5 },
          feedback: 'The follow-up disclosure is thorough and honest, including an acknowledgment that the first notice understated the scope. It helps, but the story is now "company came clean after being caught," not "company came clean."',
          doctrineNote: 'A corrected, transparent follow-up is unambiguously better than continuing to downplay — but it lands differently than leading with transparency in the first place. This is the practical cost of the minimal-disclosure choice: the option to control your own narrative was only available once, and it already passed.',
        },
        {
          id: 'b', label: "Stick to the original messaging and characterize the journalist's report as inaccurate", domains: ['pr', 'exec'],
          next: 'credibility_collapse', effects: { reputation: -30, compliance: -15 },
          feedback: 'The journalist publishes the leaked internal forensic summary the next day, directly contradicting the company’s public denial. The story is no longer about the breach. It’s about the company lying about the breach, with a document to prove it.',
          doctrineNote: 'Publicly disputing an accurate report you can’t actually refute is close to the worst available move in breach communications — it converts a bad-but-survivable disclosure story into a credibility story, which takes far longer to recover from and frequently draws additional regulatory scrutiny into whether the original filing was made in good faith.',
        },
      ],
    },

    n3b_delayed_notice: {
      id: 'n3b_delayed_notice',
      phase: 'Post-Incident Activity',
      situation: "The 'complete' investigation took ten days. GDPR's 72-hour clock closed a week ago with nothing filed. When notification finally goes out, it comes with a reasonable-sounding explanation for the delay — which regulators are not obligated to find compelling.",
      choices: [
        {
          id: 'a', label: 'File the (late) notification now with full, honest transparency about the delay and its root cause', domains: ['legal', 'exec'],
          next: 'late_gdpr_penalty', effects: { compliance: -15, financial: -25 },
          feedback: 'The late filing is complete and honest about why it’s late. A regulatory inquiry follows regardless — lateness itself is the violation, and a good explanation mitigates the penalty without eliminating it.',
          doctrineNote: 'GDPR Article 33’s 72-hour requirement is a hard deadline, not a target — being honest about why you missed it is the right thing to do and will generally reduce the eventual penalty relative to the alternative, but it doesn’t undo the fact that the deadline was legally binding regardless of investigation completeness.',
        },
        {
          id: 'b', label: 'Continue building an even more complete report before filing, now that the deadline has already passed anyway', domains: ['legal'],
          next: 'coverup_discovered', effects: { compliance: -35, reputation: -30, financial: -30 },
          feedback: 'The logic of "the deadline is already blown, so we might as well be thorough" adds another two weeks of silence. When the filing finally arrives, seventeen days after discovery, it reads less like diligence and more like what it now also is: a pattern.',
          doctrineNote: 'Once a mandatory deadline has passed, the correct response is to file immediately with what you have, not to treat the miss as license for further delay. Regulators specifically look for exactly this pattern — repeated, compounding delay — when assessing whether a violation was a mistake or a deliberate strategy.',
        },
      ],
    },

    transparent_breach_handled: {
      id: 'transparent_breach_handled', ending: true, phase: 'Post-Incident Activity',
      situation: 'The notification was specific, timely, and simultaneous to regulators and customers.',
      endingId: 'transparent_breach_handled', endingTone: 'good',
      endingSummary: "The breach is bad news, covered honestly and on time. Regulators note the timely, detailed GDPR filing; customers get specific, actionable guidance instead of vague reassurance. There's real reputational cost to any breach of this size, but the postmortem's finding is that Northlake told its own story before anyone else could, which is the difference between a difficult news cycle and a credibility crisis. This is the outcome the incident response plan is built to reach.",
    },
    late_transparency: {
      id: 'late_transparency', ending: true, phase: 'Post-Incident Activity',
      situation: 'The full story came out, but only after the press got there first.',
      endingId: 'late_transparency', endingTone: 'mixed',
      endingSummary: 'The full, honest disclosure eventually happened — but only after a journalist forced the issue, not by choice. The postmortem credits the eventual transparency while flagging the real cost of the initial minimal notice: Northlake spent its one chance to control the narrative and didn’t use it, and the eventual coverage reflects "caught, then honest" rather than "honest."',
    },
    credibility_collapse: {
      id: 'credibility_collapse', ending: true, phase: 'Post-Incident Activity',
      situation: 'The company publicly denied an accurate report and got caught doing it.',
      endingId: 'credibility_collapse', endingTone: 'bad',
      endingSummary: 'What should have been a breach story became a "the company lied about it" story, backed by a leaked document proving the denial false. Regulators open a broader inquiry into whether the original filing itself was made in good faith. The postmortem is unambiguous: disputing an accurate report you can’t refute converts a survivable incident into a credibility crisis that takes years, not news cycles, to recover from.',
    },
    overexposed_ending: {
      id: 'overexposed_ending', ending: true, phase: 'Post-Incident Activity',
      situation: 'Nine days of live access, extended for intelligence value nobody approved.',
      endingId: 'overexposed_ending', endingTone: 'bad',
      endingSummary: 'Nine total days of confirmed, unauthorized access to customer payment data — most of it after the point where technical containment should have ended the exposure. The infrastructure-mapping intelligence gathered along the way is real, but it does not offset the scope of what regulators and customers will eventually learn was left open, unapproved, for internal curiosity.',
    },
    late_gdpr_penalty: {
      id: 'late_gdpr_penalty', ending: true, phase: 'Post-Incident Activity',
      situation: 'The filing was honest but a week late.',
      endingId: 'late_gdpr_penalty', endingTone: 'bad',
      endingSummary: 'The notification was honest, complete, and a full week late. The regulatory inquiry that follows focuses specifically on the missed 72-hour deadline, not the underlying breach — a preventable, self-inflicted second problem layered on top of the first. The postmortem’s finding: "we wanted it to be complete" is not a legal defense for missing a hard deadline, however well-intentioned.',
    },
    coverup_discovered: {
      id: 'coverup_discovered', ending: true, phase: 'Post-Incident Activity',
      situation: 'Seventeen days of silence, treated as a pattern rather than a delay.',
      endingId: 'coverup_discovered', endingTone: 'bad',
      endingSummary: 'Seventeen days from discovery to filing — the original 72-hour miss compounded by two more weeks of "let’s be thorough" after the deadline had already passed. Regulators, customers, and the press all read the same timeline the same way: not a mistake, a pattern. Penalties, litigation, and reputational damage all scale with perceived intent, and seventeen days of silence reads as exactly that.',
    },
  },
};
