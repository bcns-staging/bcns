Lab.registerPage('play', {
  async render(container, { query }) {
    const scenarioId = query.get('scenario');
    container.innerHTML = '';
    if (!scenarioId) {
      container.innerHTML = '<div class="page"><h1>No scenario selected</h1><p><a href="#/home">Back to Scenario Select</a></p></div>';
      return;
    }

    const wrap = Lab.el('div', { class: 'page' });
    const titleEl = Lab.el('h1', {}, 'Loading…');
    const metersSlot = Lab.el('div', {});
    const bodySlot = Lab.el('div', {});
    wrap.appendChild(titleEl);
    wrap.appendChild(metersSlot);
    wrap.appendChild(bodySlot);
    container.appendChild(wrap);

    const { scenario } = await Lab.fetchJSON(`/api/scenarios/${scenarioId}`);
    titleEl.textContent = scenario.title;

    const storageKey = `ir-run-${scenarioId}`;
    let runId = sessionStorage.getItem(storageKey);
    let meters;

    function renderNode(node) {
      bodySlot.innerHTML = '';
      bodySlot.appendChild(Lab.el('div', { class: 'phase-badge' }, node.phase));
      bodySlot.appendChild(Lab.el('div', { class: 'situation-card' }, node.situation));
      bodySlot.appendChild(Lab.renderChoices(node.choices, async (choiceId) => {
        const res = await Lab.fetchJSON(`/api/runs/${runId}/choice`, { method: 'POST', body: { nodeId: node.id, choiceId } });
        meters = res.meters;
        metersSlot.innerHTML = '';
        metersSlot.appendChild(Lab.renderMeters(meters));
        renderConsequence(res);
      }));
    }

    function renderConsequence(res) {
      bodySlot.innerHTML = '';
      bodySlot.appendChild(Lab.el('div', { class: 'situation-card' }, res.feedback));
      bodySlot.appendChild(Lab.el('div', { class: 'doctrine-note' }, [
        Lab.el('div', { class: 'dn-label' }, 'IR Doctrine'),
        res.doctrineNote,
      ]));
      bodySlot.appendChild(Lab.el('button', {
        onclick: () => {
          if (res.ended) {
            sessionStorage.removeItem(storageKey);
            renderReportCard(res.result);
          } else {
            renderNode(res.node);
          }
        },
      }, res.ended ? 'See Report Card' : 'Continue'));
    }

    function renderReportCard(result) {
      bodySlot.innerHTML = '';
      bodySlot.appendChild(Lab.el('div', { class: `ending-banner ${Lab.toneClass(result.endingTone)}` }, [
        Lab.el('div', { class: 'grade-letter' }, result.grade.letter),
        Lab.el('div', { class: 'grade-composite' }, `Composite score: ${result.grade.composite}/100`),
      ]));
      bodySlot.appendChild(Lab.el('div', { class: 'situation-card' }, result.endingSummary));
      bodySlot.appendChild(Lab.el('div', { class: 'toolbar' }, [
        Lab.el('a', { class: 'btn', href: `#/play?scenario=${scenario.id}&r=${Date.now()}` }, 'Replay'),
        Lab.el('a', { class: 'btn secondary', href: '#/home' }, 'Back to Scenario Select'),
        Lab.el('a', { class: 'btn secondary', href: '#/scoreboard' }, 'View Scoreboard'),
      ]));
    }

    // Resume an in-progress run if one exists for this scenario; otherwise
    // fall through to the briefing screen below.
    if (runId) {
      try {
        const state = await Lab.fetchJSON(`/api/runs/${runId}`);
        if (state.status === 'in-progress') {
          meters = state.meters;
          metersSlot.appendChild(Lab.renderMeters(meters));
          renderNode(state.node);
          return;
        }
      } catch {
        // stale/unknown run id -- fall through to a fresh start
      }
      sessionStorage.removeItem(storageKey);
      runId = null;
    }

    bodySlot.appendChild(Lab.el('div', { class: 'situation-card' }, scenario.briefing));
    bodySlot.appendChild(Lab.el('button', {
      onclick: async () => {
        const started = await Lab.fetchJSON('/api/runs', { method: 'POST', body: { scenarioId } });
        runId = started.runId;
        sessionStorage.setItem(storageKey, runId);
        meters = started.meters;
        metersSlot.innerHTML = '';
        metersSlot.appendChild(Lab.renderMeters(meters));
        renderNode(started.node);
      },
    }, 'Begin'));
  },
});
