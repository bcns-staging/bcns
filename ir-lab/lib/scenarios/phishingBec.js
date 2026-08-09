// Business Email Compromise (CEO fraud) leading to an urgent wire-transfer
// request -- centers on out-of-band verification, wire-recall time windows,
// and the organizational cost of containing an incident without
// communicating it.
module.exports = {
  id: 'phishing-bec',
  title: 'Business Email Compromise: Meridian Fabrication Co.',
  tagline: 'An "urgent, confidential" wire request lands from the CEO. He\'s not actually asking for it.',
  briefing: "You're the security lead at Meridian Fabrication, a mid-size manufacturer. Your controller just forwarded an email that looks like it's from the CEO, requesting an urgent $340,000 wire for a confidential acquisition, and specifically asking her not to call to confirm. Every decision from here touches how fast money can be verified, recalled, and how well the rest of the company learns from what almost happened.",
  domainsInvolved: ['security', 'it', 'exec', 'hr', 'pr', 'legal'],
  startNodeId: 'n1_email_received',
  nodes: {
    n1_email_received: {
      id: 'n1_email_received',
      phase: 'Detection & Analysis',
      situation: "Your controller, Priya Menon, forwards you an email that looks like it's from CEO David Cho: subject line 'CONFIDENTIAL — Urgent Wire Needed Today,' asking her to wire $340,000 to a new vendor account for an acquisition he can't discuss yet. The email says he's in back-to-back legal meetings and specifically asks her not to call, just to 'handle it and confirm once sent.' Priya has the wire form open and is waiting on you.",
      choices: [
        {
          id: 'a', label: 'Have IT check the sender domain and email headers before anyone touches the wire form', domains: ['security', 'it'],
          next: 'n2a_confirmed_spoof', effects: { containment: 15 },
          feedback: 'IT pulls the message headers in under ten minutes. The sending domain is acme-corp-inc.com — one character off from the real acmecorp.com — registered two days ago. The wire never gets sent while this is being checked.',
          doctrineNote: 'The “don’t call, just handle it” instruction is itself the single most reliable tell in BEC — it’s specifically engineered to prevent the one verification step that reliably defeats it. Checking headers/domain first, before any money moves, is exactly the right instinct.',
        },
        {
          id: 'b', label: "It says urgent and confidential — tell Priya to go ahead and send it to avoid holding up a real deal", domains: ['exec'],
          next: 'n2b_wire_sent', effects: { financial: -30, containment: -20 },
          feedback: 'Priya sends the wire. It clears in under twenty minutes — BEC operations are built for speed specifically because most banks’ fraud windows close fast. Ten minutes later, David calls about something unrelated and has no idea what wire Priya is talking about.',
          doctrineNote: 'This is the single costliest mistake in BEC: treating “urgent and confidential” as a reason to skip verification instead of the reason to verify. The FBI’s IC3 consistently ranks BEC as the highest-dollar-loss category of cybercrime precisely because this instinct is common.',
        },
        {
          id: 'c', label: 'Call David directly on his known cell number right now, bypassing email entirely', domains: ['security', 'exec'],
          next: 'n2c_verified_fake', effects: { containment: 20, compliance: 5 },
          feedback: 'David picks up on the second ring, mid-lunch, thoroughly confused — he sent no such email and has never heard of the vendor. The wire is stopped before Priya ever submits the form.',
          doctrineNote: 'A known-good out-of-band verification channel (a phone number you already had, not one from the suspicious email) is the gold-standard defense against BEC. This is the textbook correct response, and it took less time than checking headers would have.',
        },
      ],
    },

    n2a_confirmed_spoof: {
      id: 'n2a_confirmed_spoof',
      phase: 'Containment, Eradication & Recovery',
      situation: 'The lookalike domain is confirmed, and the wire never went out. IT flags that the same domain sent two other, less urgent-sounding emails to different staff over the past week — this doesn’t look like a one-off.',
      choices: [
        {
          id: 'a', label: 'Alert the bank’s fraud desk pre-emptively and notify all staff org-wide about the active attempt', domains: ['security', 'exec', 'hr'],
          next: 'n3_contained', effects: { containment: 15, compliance: 10 },
          feedback: 'The bank flags the (never-sent) wire pattern proactively, and an org-wide alert goes out describing exactly what the fake email looked like, while it’s still fresh. Two other employees who’d received similar emails this week now know to ignore them.',
          doctrineNote: 'BEC campaigns routinely target multiple employees in the same organization. Sharing indicators org-wide immediately — not just closing your own ticket — is what actually stops the second and third attempt, not just the first.',
        },
        {
          id: 'b', label: 'Just block the domain and close this out quietly — no need to alarm the whole company', domains: ['it'],
          next: 'n3b_underreacted', effects: { containment: -10, compliance: -10 },
          feedback: 'The domain gets blocked at the mail gateway. No one else at the company is told anything happened.',
          doctrineNote: 'Closing your own incident without sharing what you learned protects nothing beyond the one email you personally saw. If the same campaign targets a colleague who didn’t get the warning, you’re back to a coin flip on whether they check headers first too.',
        },
      ],
    },

    n2b_wire_sent: {
      id: 'n2b_wire_sent',
      phase: 'Containment, Eradication & Recovery',
      situation: 'The $340,000 is gone from the account. Someone on the finance team, uneasy, mentions the wire to a colleague — who’s pretty sure David is in town this week, not traveling for an acquisition.',
      choices: [
        {
          id: 'a', label: 'Call the bank’s fraud department immediately, tonight, and file an FBI IC3 report', domains: ['security', 'exec', 'legal'],
          next: 'n3c_recall_attempt', effects: { financial: 10, containment: 5 },
          feedback: 'The bank’s fraud line is open and takes the report immediately, initiating an emergency recall request to the receiving bank. The IC3 filing goes in the same night.',
          doctrineNote: 'Wire recall windows are measured in hours, not days, and get dramatically less likely to succeed once funds move past an initial intermediary account. Calling immediately, off-hours if necessary, is the only version of this response that has any realistic chance of getting money back.',
        },
        {
          id: 'b', label: 'It’s after hours — deal with it Monday morning', domains: ['exec'],
          next: 'fraud_loss_delayed', effects: { financial: -20, compliance: -10 },
          feedback: 'By Monday morning, the funds have moved through two more intermediary accounts and out of the country. The bank’s fraud team is sympathetic and unable to help.',
          doctrineNote: 'This is the exact reason “file it Monday” is the wrong call for a wire fraud report — unlike almost every other kind of incident, the window to act on a fraudulent wire is measured in hours. Every hour of delay materially reduces recovery odds.',
        },
      ],
    },

    n2c_verified_fake: {
      id: 'n2c_verified_fake',
      phase: 'Containment, Eradication & Recovery',
      situation: 'David confirms it’s fake and asks what happens now. The immediate threat is neutralized, but you still don’t know if this is simple domain spoofing or if someone’s mailbox is actually compromised.',
      choices: [
        {
          id: 'a', label: 'Alert finance and all staff org-wide right away about the active attempt', domains: ['security', 'hr', 'pr'],
          next: 'n3_contained', effects: { containment: 15, compliance: 10 },
          feedback: 'The alert goes out immediately, describing the lookalike domain and the “don’t call me” tell so everyone recognizes the pattern if it resurfaces in a different form.',
          doctrineNote: 'Same principle as the other path into this node: an incident that only you know about isn’t actually contained, it’s just unreported. The moment a threat is confirmed, that knowledge should propagate at least as fast as the attacker’s next attempt might.',
        },
        {
          id: 'b', label: 'Keep it within the finance team for now to avoid alarming everyone', domains: ['exec'],
          next: 'n3b_underreacted', effects: { containment: -5 },
          feedback: 'You keep it quiet. A few days later, a near-identical email — different name, same domain pattern — lands in the inbox of someone in accounts payable who never heard about the first attempt.',
          doctrineNote: 'This is the same failure mode regardless of which path led here: containing an incident technically without communicating it organizationally leaves every colleague who wasn’t in the room exactly as exposed as you were five minutes before the phone call.',
        },
      ],
    },

    n3_contained: {
      id: 'n3_contained',
      phase: 'Containment, Eradication & Recovery',
      situation: 'The immediate fraud attempt is dead — no money moved, and staff know what to watch for. The open question: is this purely external domain-spoofing, or did the attacker actually get into a mailbox and is reading real internal threads?',
      choices: [
        {
          id: 'a', label: 'Have IT dig into mailbox sign-in logs and forwarding rules for anything suspicious before closing this out', domains: ['security', 'it'],
          next: 'n4_deep_check', effects: { containment: 10 },
          feedback: 'IT’s audit turns up a routine but worthwhile finding: no compromised mailbox, no suspicious forwarding rules, no sign of anything beyond external spoofing. It’s a clean bill, but an earned one.',
          doctrineNote: 'Confirming how an attacker got close, not just that the immediate attempt failed, is the difference between eradication and just getting lucky this time. SP 800-61’s eradication phase exists precisely to answer “is the door actually closed” rather than assuming it.',
        },
        {
          id: 'b', label: 'It’s clearly just a spoofed external domain — close the incident and move on', domains: ['it'],
          next: 'bec_thwarted_shallow', effects: { containment: 10, compliance: -5 },
          feedback: 'You close the ticket on the assumption that it was external. It probably was — but nobody actually checked.',
          doctrineNote: 'This isn’t wrong often, which is exactly what makes it a risky habit — an assumption that happens to be correct most of the time is still an assumption, and the one time a mailbox actually was compromised, skipping this check is how it gets missed.',
        },
      ],
    },

    n3b_underreacted: {
      id: 'n3b_underreacted',
      phase: 'Containment, Eradication & Recovery',
      situation: 'Days later: a near-identical email lands in accounts payable, from a slightly different lookalike domain, asking for a rushed payment to a “new supplier.” Nobody there heard about the first attempt.',
      choices: [
        {
          id: 'a', label: 'Escalate now — alert everyone org-wide and loop in the bank before any payment goes out', domains: ['security', 'hr', 'exec'],
          next: 'n3_contained', effects: { containment: 5, reputation: 5 },
          feedback: 'This time the alert goes out before any money moves, and the accounts payable team recognizes the pattern from the (now-shared) description.',
          doctrineNote: 'Recovering from an under-response by finally sharing what’s known org-wide is exactly the right move — it’s just later, and after an unnecessary second near-miss, than it needed to be.',
        },
        {
          id: 'b', label: 'Nothing changes yet — accounts payable has no reason to be suspicious of a normal-looking request', domains: ['exec'],
          next: 'second_wave_hits', effects: { financial: -25, compliance: -15, reputation: -10 },
          feedback: 'Accounts payable, with no idea a nearly identical attempt happened days earlier, sends the payment. The postmortem’s hardest question is why the first incident’s lessons never reached them.',
          doctrineNote: 'This is the direct, avoidable cost of under-communicating a contained incident: the org didn’t get a second chance at a different attack, it got hit by the same attack again, on a colleague who had no way to know it was coming.',
        },
      ],
    },

    n3c_recall_attempt: {
      id: 'n3c_recall_attempt',
      phase: 'Containment, Eradication & Recovery',
      situation: 'The bank’s fraud team is working the recall. It’s genuinely uncertain — recall success depends entirely on whether the receiving bank still holds the funds or has already moved them onward.',
      choices: [
        {
          id: 'a', label: 'Wait it out and hope the receiving bank still has the funds on hold', domains: ['exec'],
          next: 'wire_recalled', effects: { financial: 20, containment: 10 },
          feedback: 'The receiving bank confirms the funds were frozen before onward transfer and returns them, minus a modest processing delay. It’s a genuinely good outcome, and a fairly lucky one — recall success rates on international wire fraud are far from guaranteed even when reported immediately.',
          doctrineNote: 'Even the fastest possible response doesn’t guarantee recovery — but it’s the only response that gives recovery a realistic chance at all. This outcome rewards having called immediately, not having controlled the result, which was never fully in your hands.',
        },
        {
          id: 'b', label: 'Push the bank for a status update — the funds may already be gone', domains: ['exec'],
          next: 'fraud_loss_full', effects: { financial: -10, containment: -5 },
          feedback: 'The funds are gone. The immediate call to the bank was still the right move — it simply didn’t win this time, because the money had already cleared the first intermediary account before the report went in.',
          doctrineNote: 'This is the sobering reality of wire fraud recovery: acting fast maximizes the odds, it doesn’t guarantee them. The postmortem still credits the fast report as correct process, distinct from the outcome — a distinction real incident reviews are supposed to make and often don’t.',
        },
      ],
    },

    n4_deep_check: {
      id: 'n4_deep_check',
      phase: 'Post-Incident Activity',
      situation: 'Mailbox audit comes back clean. Time for the actual postmortem: how does the company make sure the next attempt doesn’t even get this close?',
      choices: [
        {
          id: 'a', label: 'Roll out mandatory wire-verification training and a callback policy for all finance staff', domains: ['hr', 'exec'],
          next: 'bec_thwarted_thorough', effects: { compliance: 15, reputation: 10 },
          feedback: 'A short mandatory training rolls out within the week: what a BEC attempt looks like, and a hard callback-verification policy for any wire request above a threshold, no exceptions for seniority or urgency.',
          doctrineNote: 'A formal callback-verification policy — written down, applying even to “the CEO said not to call” — is the single highest-value control against BEC, because it removes the judgment call from a stressed employee in the moment and replaces it with a rule.',
        },
        {
          id: 'b', label: 'Skip formal training — everyone already knows what happened informally', domains: ['exec'],
          next: 'bec_thwarted_shallow', effects: { compliance: -5 },
          feedback: 'The story circulates informally. Without a written policy, whether the next urgent wire request gets verified depends entirely on who happens to remember this story that week.',
          doctrineNote: 'Institutional memory isn’t a control. A policy that exists because “everyone knows” rather than because it’s written down and trained on reliably fails exactly when someone new joins finance or an existing employee is stressed enough to forget.',
        },
      ],
    },

    bec_thwarted_thorough: {
      id: 'bec_thwarted_thorough', ending: true, phase: 'Post-Incident Activity',
      situation: 'No funds lost, the mailbox is confirmed clean, and a real policy is now in place.',
      endingId: 'bec_thwarted_thorough', endingTone: 'good',
      endingSummary: 'The wire was never sent, the mailbox audit came back clean, and a real callback-verification policy is now written down and trained on — not just remembered informally. The postmortem’s verdict: this is what a mature response to a BEC attempt looks like end to end, from the first suspicious header check through the organizational fix that makes the next attempt less likely to get this close. No funds lost, no gaps left for a repeat attempt to exploit.',
    },
    wire_recalled: {
      id: 'wire_recalled', ending: true, phase: 'Post-Incident Activity',
      situation: 'The emergency recall succeeded. The funds are back.',
      endingId: 'wire_recalled', endingTone: 'good',
      endingSummary: 'The wire fraud was reported within the hour, and the recall succeeded — a genuinely good outcome that isn’t guaranteed even for a fast, correct response. The funds are back, minus a short processing delay. The postmortem credits the speed of the report, not luck, since a slower report would have made recovery far less likely regardless of how the receiving bank happened to be holding the funds that day.',
    },
    bec_thwarted_shallow: {
      id: 'bec_thwarted_shallow', ending: true, phase: 'Post-Incident Activity',
      situation: 'No money moved, but nothing was actually verified or changed.',
      endingId: 'bec_thwarted_shallow', endingTone: 'mixed',
      endingSummary: 'The immediate fraud attempt failed and no money moved — a genuinely fine outcome on its face. But the mailbox was never actually audited, and no policy changed as a result. The postmortem’s finding isn’t that anything went wrong this time; it’s that the organization got the same result it would have gotten from a much more careful process, and won’t necessarily be as fortunate against a more sophisticated attempt.',
    },
    second_wave_hits: {
      id: 'second_wave_hits', ending: true, phase: 'Post-Incident Activity',
      situation: 'A second, near-identical attempt succeeded against an uninformed colleague.',
      endingId: 'second_wave_hits', endingTone: 'bad',
      endingSummary: 'A second, nearly identical BEC attempt succeeded days after the first one was quietly closed out — against a colleague who never heard the first attempt happened. The postmortem’s central finding isn’t about either individual employee’s judgment; it’s that an incident contained without being communicated isn’t actually contained, it’s just delayed.',
    },
    fraud_loss_full: {
      id: 'fraud_loss_full', ending: true, phase: 'Post-Incident Activity',
      situation: 'The recall failed. The funds are gone.',
      endingId: 'fraud_loss_full', endingTone: 'bad',
      endingSummary: 'The $340,000 is gone. The report to the bank was fast and the process was correct, but the funds had already cleared the first intermediary account before the fraud desk could act. The postmortem draws a deliberate distinction here: the response process gets a passing grade, the outcome doesn’t, and conflating the two is exactly the mistake a good postmortem is supposed to avoid.',
    },
    fraud_loss_delayed: {
      id: 'fraud_loss_delayed', ending: true, phase: 'Post-Incident Activity',
      situation: 'The report waited for Monday. The funds didn’t.',
      endingId: 'fraud_loss_delayed', endingTone: 'bad',
      endingSummary: 'The $340,000 moved out of the country over the weekend while the report waited for Monday morning. Unlike almost every other category of incident, a fraudulent wire has a recovery window measured in hours — and this one closed. The postmortem’s finding is blunt: “file it Monday” is not an acceptable response to a suspected wire fraud, ever, regardless of the hour it’s discovered.',
    },
  },
};
