import katex from 'katex';
import 'katex/dist/katex.min.css';

export const setupTinyMceMath = (editor: any) => {
  editor.ui.registry.addButton('latex', {
    text: '∑ Math',
    tooltip: 'Insert LaTeX Math Expression',
    onAction: () => {
      editor.windowManager.open({
        title: 'Insert LaTeX Math',
        body: {
          type: 'panel',
          items: [
            {
              type: 'textarea',
              name: 'latex',
              label: 'Enter LaTeX expression (e.g. \\frac{1}{2})'
            }
          ]
        },
        buttons: [
          { type: 'cancel', text: 'Cancel' },
          { type: 'submit', text: 'Insert Math', primary: true }
        ],
        onSubmit: (api: any) => {
          const data = api.getData();
          if (!data.latex) {
            api.close();
            return;
          }
          try {
            const html = katex.renderToString(data.latex, { throwOnError: false, displayMode: true });
            editor.insertContent(`&nbsp;<span class="math-tex mceNonEditable" data-latex="${encodeURIComponent(data.latex)}" contenteditable="false">${html}</span>&nbsp;`);
            api.close();
          } catch (e) {
            alert("Invalid LaTeX expression!");
          }
        }
      });
    }
  });

  // Handle clicking on existing math spans to edit them
  editor.on('click', (e: any) => {
    const target = e.target as HTMLElement;
    const mathSpan = target.closest('.math-tex');
    
    if (mathSpan) {
      const rawLatex = decodeURIComponent(mathSpan.getAttribute('data-latex') || '');
      if (rawLatex) {
        editor.windowManager.open({
          title: 'Edit LaTeX Math',
          body: {
            type: 'panel',
            items: [{ type: 'textarea', name: 'latex', label: 'LaTeX Expression' }]
          },
          initialData: { latex: rawLatex },
          buttons: [
            { type: 'cancel', text: 'Cancel' },
            { type: 'submit', text: 'Update', primary: true }
          ],
          onSubmit: (api: any) => {
            const data = api.getData();
            try {
              const html = katex.renderToString(data.latex, { throwOnError: false, displayMode: true });
              mathSpan.outerHTML = `<span class="math-tex mceNonEditable" data-latex="${encodeURIComponent(data.latex)}" contenteditable="false">${html}</span>`;
              api.close();
            } catch (err) {
              alert("Invalid LaTeX expression!");
            }
          }
        });
      }
    }
  });
};

export const tinymceMathContentStyle = `
@import url('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css');
.math-tex { display: inline-block; cursor: pointer; border-radius: 4px; padding: 0 4px; vertical-align: middle; }
.math-tex:hover { background: rgba(255, 255, 255, 0.1); outline: 1px dashed #a855f7; }
`;
