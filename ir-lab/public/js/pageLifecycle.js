const LIFECYCLE_PHASES = ['Preparation', 'Detection & Analysis', 'Containment, Eradication & Recovery', 'Post-Incident Activity'];
const LIFECYCLE_QUESTIONS = [
  { action: 'Pre-approving containment authority so nobody has to seek sign-off mid-incident', phase: 'Preparation' },
  { action: 'Running a tabletop exercise before any real incident occurs', phase: 'Preparation' },
  { action: 'Correlating SIEM alerts to confirm how many hosts are actually affected', phase: 'Detection & Analysis' },
  { action: 'Confirming exactly which records an exfiltration actually touched', phase: 'Detection & Analysis' },
  { action: "Revoking a compromised account's credentials the moment unauthorized access is confirmed", phase: 'Containment, Eradication & Recovery' },
  { action: 'Verifying a backup is actually clean before restoring from it', phase: 'Containment, Eradication & Recovery' },
  { action: 'Holding a blameless postmortem to update the incident response plan based on what actually happened', phase: 'Post-Incident Activity' },
  { action: 'Filing a written policy change so the next employee facing this situation has a rule to follow, not a story to remember', phase: 'Post-Incident Activity' },
];

Lab.registerPage('lifecycle', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'NIST SP 800-61: The Incident Response Lifecycle', route: 'lifecycle' });
    body.innerHTML = '';
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Every doctrine note across every scenario ties back to one of the four phases below. Match each action to its phase, then check your answers.'));

    const selects = LIFECYCLE_QUESTIONS.map(() => Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose a phase --'),
      ...LIFECYCLE_PHASES.map((p) => Lab.el('option', { value: p }, p)),
    ]));

    LIFECYCLE_QUESTIONS.forEach((q, i) => {
      body.appendChild(Lab.el('div', { class: 'field-row', style: 'align-items:center;' }, [
        Lab.el('div', { style: 'flex:2; min-width:260px;' }, q.action),
        Lab.el('div', {}, selects[i]),
      ]));
    });

    const resultBox = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: () => {
        let correct = 0;
        LIFECYCLE_QUESTIONS.forEach((q, i) => { if (selects[i].value === q.phase) correct += 1; });
        resultBox.innerHTML = '';
        const cls = correct === LIFECYCLE_QUESTIONS.length ? 'good' : correct >= LIFECYCLE_QUESTIONS.length / 2 ? 'warn' : 'bad';
        resultBox.appendChild(Lab.el('p', {}, [Lab.el('span', { class: `badge ${cls}` }, `${correct} / ${LIFECYCLE_QUESTIONS.length}`), ' correct']));
      },
    }, 'Check answers'));
    body.appendChild(resultBox);
  },
});
