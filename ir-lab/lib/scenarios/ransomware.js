// Hospital ransomware: the classic pay/restore/negotiate dilemma, with a
// HIPAA notification clock running underneath every other decision.
// This is the template scenario -- every other scenario in lib/scenarios/
// follows this same shape: a first decision node, 2-3 second-tier nodes,
// a hub node most paths converge on, and a final split into endings.
module.exports = {
  id: 'ransomware',
  title: 'Ransomware: Metro West Regional Medical Center',
  tagline: 'A ransom note appears on 40+ endpoints at 6:12 AM. Patient scheduling is down.',
  briefing: "You're the on-call Incident Commander for Metro West Regional Medical Center. It's 6:12 AM. The SOC's EDR platform just fired an alert storm, and the hospital's patient scheduling system has gone dark. Every decision from here touches technical containment, legal notification obligations, public communications, and the hospital's ability to keep functioning -- and every one of them has to be made with less certainty than you'd like.",
  domainsInvolved: ['security', 'it', 'legal', 'exec'],
  startNodeId: 'n1_detect',
  nodes: {
    n1_detect: {
      id: 'n1_detect',
      phase: 'Detection & Analysis',
      situation: "It's 6:12 AM. Your phone won't stop buzzing. The SOC's EDR platform has fired an alert storm — over 40 endpoints across three departments have simultaneously gone dark and reappeared showing the same black screen: a ransom note. The hospital's patient scheduling system, which runs on a subset of those machines, is unreachable. Nurses are already calling the help desk asking if they should switch to paper charting. You have no idea yet how far this has spread.",
      choices: [
        {
          id: 'a', label: 'Isolate the affected network segment immediately, even before you know the full scope', domains: ['security', 'it'],
          next: 'n2a_contained_early', effects: { containment: 20, financial: -5 },
          feedback: "You pull the trigger on segment isolation within minutes of the first alert. It's a blunt instrument — cutting network access for that segment takes down some healthy systems along with the infected ones — but it works: the ransomware's lateral movement stalls at roughly 40 hosts instead of spreading further.",
          doctrineNote: 'NIST SP 800-61 is explicit that containment strategies should be pre-approved and acted on with incomplete information — waiting for full certainty during an active spread is itself a decision, and usually the wrong one. Availability cost (some healthy systems losing connectivity) is an acceptable tradeoff against unconstrained lateral movement.',
        },
        {
          id: 'b', label: 'Hold off — first confirm the full scope through SIEM log correlation', domains: ['security'],
          next: 'n2b_contained_late', effects: { containment: -20 },
          feedback: "Ninety minutes into correlating logs, you have a much clearer picture — and a much worse one. While you were building certainty, the ransomware kept moving. It's now on 140 hosts, including, critically, the on-site backup server.",
          doctrineNote: 'This is a textbook containment-delay failure. SP 800-61 recommends pre-defining containment criteria specifically so that this trade-off doesn’t have to be made in real time under pressure — every minute spent achieving analytical certainty is a minute the adversary spends spreading.',
        },
        {
          id: 'c', label: 'Escalate to the CEO and general counsel first, and hold technical action pending their authorization', domains: ['exec', 'legal'],
          next: 'n2c_briefed_first', effects: { compliance: 10, containment: -15 },
          feedback: "Legal moves fast to put the incident under attorney-client privilege before anyone touches a keyboard — a genuinely smart move that will protect forensic findings later. But it takes 45 minutes to get everyone on a call and agree on next steps, and the ransomware doesn't wait for quorum.",
          doctrineNote: 'Engaging counsel early to establish privilege over the investigation is real best practice, used by most mature IR programs. The mistake here isn’t looping in legal — it’s treating technical containment and legal notification as sequential instead of parallel. A prepared organization does both at once.',
        },
      ],
    },

    n2a_contained_early: {
      id: 'n2a_contained_early',
      phase: 'Containment, Eradication & Recovery',
      situation: "Isolation held. You're looking at roughly 40 encrypted endpoints, contained to one wing. The retained IR firm's on-call analyst calls back within the hour and confirms what the ransom note said: a $2,000,000 demand in Monero, with a 72-hour countdown before the attackers say they'll begin selling any data they exfiltrated before encrypting.",
      choices: [
        {
          id: 'a', label: 'Activate the cyber-insurance hotline and the pre-negotiated IR retainer right now', domains: ['exec', 'security'],
          next: 'n3_ir_engaged', effects: { containment: 10, financial: -15, compliance: 10 },
          feedback: "Your insurer's breach-coach and the retained IR firm are looped in within the hour, exactly as your incident response plan specified. Legal privilege is established over the whole engagement from this point forward.",
          doctrineNote: 'This is the single highest-leverage move available in a ransomware event with cyber insurance: insurers typically pre-approve specific IR firms and negotiators, and using them (rather than improvising) usually keeps costs covered and keeps you inside your policy’s terms.',
        },
        {
          id: 'b', label: 'Handle it quietly in-house for now to keep control of the narrative', domains: ['exec'],
          next: 'n3b_quiet_handling', effects: { reputation: -15, containment: 5 },
          feedback: "You keep the circle small. It buys you a few hours of calm — until a nurse posts a photo of the ransom note screen to social media, and a local reporter calls the hospital's press line asking for comment. You're now managing a leak, not a secret.",
          doctrineNote: 'Attempting to fully suppress knowledge of an active incident almost never survives contact with an organization’s actual size. Modern breach-notification laws (HIPAA for a hospital, most U.S. state laws generally) also start disclosure clocks from the moment of discovery, not from a public disclosure decision — delay accrues legal risk whether or not it works as a PR strategy.',
        },
        {
          id: 'c', label: 'Wipe and restore all affected servers from last night’s backup right now, no integrity verification', domains: ['it'],
          next: 'n4_backup_gamble', effects: { containment: 15 },
          feedback: 'IT starts a full restore from last night’s backup set immediately. Systems start coming back online within the hour — a genuinely fast recovery, on the surface.',
          doctrineNote: 'Speed here is appealing but skips a critical SP 800-61 eradication step: confirming backups are actually clean before trusting them, and confirming the original entry vector is closed. Restoring onto a still-open door, or restoring an already-compromised backup, just resets the clock on the same incident.',
        },
      ],
    },

    n2b_contained_late: {
      id: 'n2b_contained_late',
      phase: 'Containment, Eradication & Recovery',
      situation: 'The picture is worse now. 140 hosts encrypted, and forensics confirms the on-premise backup server was compromised during the same window — its most recent backup set may not be trustworthy. The attackers, apparently noticing the delay, have raised their demand to $3,500,000 and shortened the countdown to 48 hours.',
      choices: [
        {
          id: 'a', label: 'Activate the IR retainer and insurance hotline now, late as it is', domains: ['exec', 'security'],
          next: 'n3_ir_engaged', effects: { containment: 5, financial: -15 },
          feedback: 'Better late than never — the retained IR firm and insurer are engaged, but they’re starting from a much larger blast radius than they would have an hour and a half ago.',
          doctrineNote: 'The engagement itself is still the right call; SP 800-61’s guidance doesn’t change based on how contained the incident currently is. What changed is the cost of the earlier delay, which this choice can’t undo, only stop from compounding further.',
        },
        {
          id: 'b', label: 'Attempt a backup restore anyway', domains: ['it'],
          next: 'n4_backup_gamble', effects: { containment: 10 },
          feedback: 'Against the odds, IT starts restoring from the (possibly compromised) backup set across all 140 hosts. It’s a bigger, riskier version of the same gamble.',
          doctrineNote: 'Restoring without integrity verification is risky at 40 hosts; at 140, with the backup server itself confirmed compromised, it’s a much larger bet on unverified infrastructure.',
        },
      ],
    },

    n2c_briefed_first: {
      id: 'n2c_briefed_first',
      phase: 'Containment, Eradication & Recovery',
      situation: "The privileged call wraps. Legal has a plan for evidence handling and disclosure obligations. But the ransomware hasn't been waiting on your conference call — the note on-screen now claims 'additional systems secured' and the countdown timer has appeared on every infected endpoint's desktop wallpaper.",
      choices: [
        {
          id: 'a', label: 'Move to isolate now, under privilege, with the IR firm engaged in parallel', domains: ['security', 'legal', 'exec'],
          next: 'n3_ir_engaged', effects: { containment: 10, compliance: 15, financial: -10 },
          feedback: 'You finally move on both fronts at once — technical containment and legal engagement, running in parallel instead of sequentially. It’s later than ideal, but from here on the response is coordinated correctly.',
          doctrineNote: 'This is the actual right shape of a mature response: legal and technical workstreams running simultaneously, not gated on each other. The lesson from this path isn’t “don’t call legal early” — it’s “don’t let calling legal be the reason technical containment waits.”',
        },
        {
          id: 'b', label: 'Keep deliberating with the board before authorizing any action', domains: ['exec'],
          next: 'n2b_contained_late', effects: { containment: -15 },
          feedback: 'The board wants more information before approving action. By the time you reconvene, the ransomware has kept spreading regardless of what the org chart was doing.',
          doctrineNote: 'Ransomware does not pause for governance processes. Whatever authorization structure an incident response plan requires should be pre-delegated for exactly this scenario — deciding who can authorize containment during the incident is a Preparation-phase failure showing up in real time.',
        },
      ],
    },

    n3_ir_engaged: {
      id: 'n3_ir_engaged',
      phase: 'Containment, Eradication & Recovery',
      situation: 'The retained IR firm has done initial attribution: this matches a known ransomware-as-a-service affiliate with a documented pattern of double extortion — encrypt now, threaten to leak stolen data later regardless of payment. Their lead negotiator lays out the options plainly, and looks at you to make the call.',
      choices: [
        {
          id: 'a', label: 'Refuse to pay. Restore fully from IR-verified clean backups', domains: ['it', 'exec'],
          next: 'clean_recovery', effects: { containment: 20, financial: 5 },
          feedback: 'The IR firm forensically verifies an offline backup set predates the intrusion. Recovery takes days, not hours, but every restored system is confirmed clean before it’s reconnected.',
          doctrineNote: 'This is the outcome every IR plan is built around: verified-clean backups make the ransom demand irrelevant. It’s also the only path that doesn’t fund the attacker’s next operation — the FBI and CISA both officially discourage payment partly because it has no guarantee of data deletion and directly finances further attacks.',
        },
        {
          id: 'b', label: 'Pay the demand for a faster decryption key and a promise of data deletion', domains: ['exec'],
          next: 'paid_ransom', effects: { containment: 15, financial: -30, compliance: -10, reputation: -5 },
          feedback: 'The payment goes through via the negotiator. A working decryptor arrives within hours and recovery is fast. There is, and will only ever be, the attacker’s word that the stolen data was actually deleted.',
          doctrineNote: 'Paying is a real, legal (in most jurisdictions, with OFAC sanctions-screening caveats the IR firm handles) option that sometimes is the least-bad choice under time pressure. But it doesn’t resolve the data-exposure risk, may trigger additional regulatory scrutiny for funding a possibly-sanctioned entity, and provides no verifiable guarantee — which is exactly what shows up in the compliance and reputation cost here.',
        },
        {
          id: 'c', label: 'Negotiate for more time while backups are verified in parallel', domains: ['security', 'exec'],
          next: 'n5_negotiate', effects: { containment: 5 },
          feedback: 'The negotiator opens a dialogue to buy 3-4 extra days — enough time, hopefully, to confirm backup integrity without the pressure of an imminent deadline.',
          doctrineNote: 'Professional ransomware negotiators exist precisely because buying verifiable time is often better than a rushed binary choice. It doesn’t guarantee a good outcome, but it converts an artificial attacker-imposed deadline into your own timeline wherever possible.',
        },
      ],
    },

    n3b_quiet_handling: {
      id: 'n3b_quiet_handling',
      phase: 'Containment, Eradication & Recovery',
      situation: "The leak has already happened — a photo of a ransom note on a nurse's station monitor is circulating on social media, and the hospital's front desk has fielded three press calls this morning. Legal flags that HIPAA's breach notification clock started at the moment of discovery, not now, and that clock does not pause for reputation management.",
      choices: [
        {
          id: 'a', label: 'Reverse course — bring in legal and the IR firm properly before the notification deadline passes', domains: ['legal', 'exec'],
          next: 'n3_ir_engaged', effects: { reputation: -10, compliance: 10 },
          feedback: 'You course-correct. It costs you a rough news cycle about the hospital’s initial silence, but the actual notification and technical response now proceed on a sound, defensible footing.',
          doctrineNote: 'Recovering from a slow start by finally doing the response correctly is far better than continuing to compound the delay. Regulators and courts both distinguish meaningfully between “responded late but in good faith once discovered” and the alternative in the other branch.',
        },
        {
          id: 'b', label: 'Continue managing this quietly and let the notification deadline pass', domains: ['exec'],
          next: 'coverup_ending', effects: { compliance: -35, reputation: -25 },
          feedback: 'The statutory notification window closes with no formal disclosure filed. When the story eventually breaks in full — and it does — the story is no longer just “hospital hit by ransomware.” It’s “hospital knew and said nothing.”',
          doctrineNote: 'This is the single most consequential mistake path in incident response: missing a legally mandated disclosure deadline converts a security incident into a regulatory and legal liability event, with penalties (under HIPAA, state breach laws, and potentially the FTC) that are frequently larger than the cost of the original incident.',
        },
      ],
    },

    n4_backup_gamble: {
      id: 'n4_backup_gamble',
      phase: 'Containment, Eradication & Recovery',
      situation: "The restore is most of the way through when a forensic sweep of the backup images turns up the same encryptor signature — dormant, waiting for a trigger. The attacker had dwell time on the network for weeks before detonating, long enough to quietly compromise multiple backup generations. You didn't restore a clean environment. You restored a delayed second detonation.",
      choices: [
        {
          id: 'a', label: 'Halt the restore, fall back, and engage the IR retainer and insurer now', domains: ['security', 'exec'],
          next: 'n3_ir_engaged', effects: { containment: -10, financial: -15 },
          feedback: 'You stop the bleeding and bring in the professionals who should have been engaged from the start. The weeks-old dwell time means the eventual clean-recovery timeline is now longer than it would have been.',
          doctrineNote: 'This is a recoverable mistake, and recovering from it (rather than doubling down) is the right instinct — but it illustrates why SP 800-61’s eradication guidance insists on verifying backup integrity and confirming the intrusion’s actual start date before trusting any recovery path.',
        },
        {
          id: 'b', label: 'Panic-pay the ransom immediately, without the IR firm or legal involved', domains: ['exec'],
          next: 'paid_blind', effects: { financial: -35, compliance: -20, containment: -10 },
          feedback: 'You wire the payment directly, without a vetted negotiator, without sanctions screening, and without legal review of what you’re agreeing to. The decryption key that arrives only partially works, and you’re now both out the ransom and still mid-incident.',
          doctrineNote: 'Paying without OFAC sanctions screening carries genuine legal exposure — some ransomware affiliates are on U.S. sanctions lists, and paying them (even unknowingly) can be a federal violation regardless of intent. This is precisely the scenario a retained IR firm’s negotiator exists to prevent.',
        },
      ],
    },

    n5_negotiate: {
      id: 'n5_negotiate',
      phase: 'Containment, Eradication & Recovery',
      situation: 'The extra days bought you room to work. Forensics is racing to verify an offline backup generation from before the estimated intrusion date. Then, on day three, the countdown ends early: the attacker posts a sample of exfiltrated patient records to a leak site to force the issue.',
      choices: [
        {
          id: 'a', label: 'The backups verify clean in time — refuse to pay, restore', domains: ['it', 'exec'],
          next: 'negotiated_no_pay', effects: { containment: 20, reputation: 10, financial: 10 },
          feedback: 'The verification finishes hours before the leak. You restore from confirmed-clean backups, refuse the payment, and can tell regulators, patients, and the board a complete, honest, and ultimately successful story.',
          doctrineNote: 'This is the best realistic outcome in a ransomware event with an unclear backup situation: buying time to verify converted a coin-flip into a controlled recovery. It’s also the strongest possible position for the mandatory breach notification, which still has to happen because data was exfiltrated regardless of the encryption outcome.',
        },
        {
          id: 'b', label: 'Pay immediately to try to stop further data being posted', domains: ['exec', 'legal'],
          next: 'paid_after_leak', effects: { financial: -25, reputation: -20, compliance: -10 },
          feedback: 'You pay in an attempt to halt further leaks. The attacker takes the sample down as agreed — but the sample is already screenshotted and re-posted elsewhere within a day, and payment after a leak has already started provides no additional legal protection.',
          doctrineNote: 'Once data has been posted publicly, the breach-notification obligation is already triggered and payment cannot retroactively undo the exposure. Negotiators generally advise against paying specifically to suppress an active leak, since there’s no mechanism to guarantee removal once data has left the attacker’s sole control.',
        },
      ],
    },

    clean_recovery: {
      id: 'clean_recovery', ending: true, phase: 'Post-Incident Activity',
      situation: 'Full recovery is complete. Every system was verified clean before reconnection.',
      endingId: 'clean_recovery', endingTone: 'good',
      endingSummary: "Full recovery, verified clean, ransom unpaid. It took four days longer than a best-case scenario and the isolation period had real operational cost, but every restored system was confirmed free of the intrusion before reconnection, and no payment went to the attacker. The post-incident review credits early, decisive containment and a properly engaged IR retainer. HIPAA notification went out within the required window with a complete, accurate account of what happened. The board's biggest lesson: pre-authorize containment authority before the next incident, not during it.",
    },
    negotiated_no_pay: {
      id: 'negotiated_no_pay', ending: true, phase: 'Post-Incident Activity',
      situation: 'The verified-clean restore completes just ahead of the leak deadline.',
      endingId: 'negotiated_no_pay', endingTone: 'good',
      endingSummary: "The best realistic outcome available: buying time under pressure paid off, backups verified clean just ahead of the attacker's deadline, and the ransom went unpaid. Regulatory notification covered both the encryption and the exfiltration honestly. The postmortem holds this up as the model response — technical containment, legal engagement, and a professional negotiator all working in parallel from the point of escalation onward, exactly as the incident response plan intended.",
    },
    paid_ransom: {
      id: 'paid_ransom', ending: true, phase: 'Post-Incident Activity',
      situation: 'The ransom is paid. A working decryptor arrives.',
      endingId: 'paid_ransom', endingTone: 'mixed',
      endingSummary: "Systems are back online, faster than the alternative. The ransom is paid, the decryptor works, and operations resume within a day. But there is no way to verify the attacker actually deleted the exfiltrated data, and the payment itself draws scrutiny from the insurer and, later, a state regulator asking why alternatives weren't pursued first. The postmortem calls this outcome 'operationally successful, strategically incomplete' — a real, defensible choice under pressure, but not the one the incident response plan was designed to reach for first.",
    },
    paid_after_leak: {
      id: 'paid_after_leak', ending: true, phase: 'Post-Incident Activity',
      situation: 'The payment goes through, but the leaked sample is already out.',
      endingId: 'paid_after_leak', endingTone: 'bad',
      endingSummary: "The payment didn't stop what it was meant to stop. The leaked sample resurfaces regardless, the breach-notification obligation was already triggered before the payment was even wired, and the ransom is now an added cost on top of a disclosure that has to happen anyway. The postmortem's core finding: payment made after data is already public buys nothing but a false sense of resolution.",
    },
    paid_blind: {
      id: 'paid_blind', ending: true, phase: 'Post-Incident Activity',
      situation: 'The panic payment only partially worked, and it was never screened.',
      endingId: 'paid_blind', endingTone: 'bad',
      endingSummary: "An unvetted, unscreened payment, made in panic, that only partially worked. The organization is out the ransom, still mid-incident, and now facing a potential federal sanctions inquiry into who the payment actually went to. This is the outcome every retained-IR-firm negotiator exists specifically to prevent, and the postmortem is blunt about it: never wire a ransom payment without sanctions screening and legal review, regardless of the time pressure.",
    },
    coverup_ending: {
      id: 'coverup_ending', ending: true, phase: 'Post-Incident Activity',
      situation: 'The notification deadline passed. The story eventually broke anyway.',
      endingId: 'coverup_ending', endingTone: 'bad',
      endingSummary: "The statutory notification deadline passed with nothing filed. When the full story surfaced — and it did, days later, through a patient's own discovery — the coverage was no longer about a ransomware attack. It was about an organization that knew and stayed silent. Regulatory penalties for the missed HIPAA deadline substantially exceeded the cost of the original incident, a class-action followed, and the CEO's resignation was announced the same week as the settlement. The postmortem's single line: the technology incident was survivable; the decision to hide it was not.",
    },
  },
};
