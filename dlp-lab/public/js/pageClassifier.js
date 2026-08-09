Lab.registerPage('classifier', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Statistical Classifier', route: 'classifier' });
    body.innerHTML = '';

    const statsBox = Lab.el('div', {});
    async function refreshStats() {
      const stats = await Lab.fetchJSON('/api/classifier/stats');
      statsBox.innerHTML = '';
      if (!stats.classes.length) {
        statsBox.appendChild(Lab.el('p', { class: 'muted' }, 'Not trained yet -- add some labeled examples below.'));
        return;
      }
      statsBox.appendChild(Lab.el('p', {}, `Vocabulary size: ${stats.vocabSize}`));
      statsBox.appendChild(Lab.el('div', { class: 'card-grid' }, stats.classes.map((c) => Lab.el('div', { class: 'card' }, [
        Lab.el('h4', {}, `"${c.label}" (${c.docCount} examples)`),
        Lab.el('p', { class: 'muted' }, 'Most indicative words:'),
        Lab.el('p', {}, c.topWords.map((w) => `${w.word} (${w.count})`).join(', ')),
      ]))));
    }

    body.appendChild(Lab.el('h3', {}, 'Model state'));
    body.appendChild(statsBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Add labeled training examples'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'The more examples of each class you add, the sharper the classifier gets -- try classifying the same text before and after adding more examples.'));
    const sensitiveExamples = Lab.el('textarea', { placeholder: 'one example per line, labeled "sensitive"' }, 'quarterly earnings report confidential financial results pending merger\nemployee salary compensation social security payroll records\nboard meeting minutes acquisition due diligence confidential');
    const notSensitiveExamples = Lab.el('textarea', { placeholder: 'one example per line, labeled "not-sensitive"' }, 'weekly team newsletter birthday celebration announcement\nlunch menu today pizza salad soup cafeteria\noffice holiday party schedule and decorations');
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, '"sensitive" examples'), sensitiveExamples]),
      Lab.el('div', {}, [Lab.el('label', {}, '"not-sensitive" examples'), notSensitiveExamples]),
    ]));
    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', {
        onclick: async () => {
          const examples = [
            ...sensitiveExamples.value.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, label: 'sensitive' })),
            ...notSensitiveExamples.value.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, label: 'not-sensitive' })),
          ];
          if (!examples.length) return;
          await Lab.fetchJSON('/api/classifier/train', { method: 'POST', body: { examples } });
          refreshStats();
        },
      }, 'Add to model'),
      Lab.el('button', {
        class: 'danger',
        onclick: async () => { await Lab.fetchJSON('/api/classifier/reset', { method: 'POST' }); refreshStats(); },
      }, 'Reset model'),
    ]));

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Classify new text'));
    const testInput = Lab.el('textarea', {}, 'the confidential merger and acquisition financial report');
    const testOutput = Lab.el('div', {});
    body.appendChild(testInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/classifier/classify', { method: 'POST', body: { text: testInput.value } });
        testOutput.innerHTML = '';
        if (!res.label) { testOutput.appendChild(Lab.el('p', { class: 'muted' }, 'Model not trained yet.')); return; }
        testOutput.appendChild(Lab.el('p', {}, [Lab.el('span', { class: `badge ${res.label === 'sensitive' ? 'high' : 'low'}` }, res.label), ` (${Math.round(res.confidence * 100)}% confidence)`]));
        testOutput.appendChild(Lab.el('p', { class: 'muted' }, Object.entries(res.scores).map(([l, s]) => `${l}: ${Math.round(s * 100)}%`).join('  |  ')));
      },
    }, 'Classify'));
    body.appendChild(testOutput);

    refreshStats();
  },
});
