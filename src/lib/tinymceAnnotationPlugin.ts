export const tinymceAnnotationContentStyle = `
.lesson-annotation {
  display: inline-flex;
  align-items: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25));
  color: #6ee7b7;
  font-weight: 700;
  border: 1px solid rgba(52, 211, 153, 0.6);
  border-radius: 6px;
  padding: 2px 7px;
  margin: 0 2px;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.35), inset 0 0 6px rgba(52, 211, 153, 0.15);
  cursor: pointer;
  text-decoration: none;
}
.lesson-annotation:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(6, 182, 212, 0.4));
  border-color: rgba(52, 211, 153, 0.9);
  color: #ffffff;
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.55);
}
`;

export const setupTinyMceAnnotation = (editor: any, getInteractiveMaps: () => {id: string, title: string}[] = () => []) => {
  editor.ui.registry.addButton('annotation', {
    text: 'Tag',
    tooltip: 'Add Interactive Annotation',
    icon: 'bookmark',
    onAction: () => {
      // 1. Get the selected text as raw text
      const selectedText = editor.selection.getContent({ format: 'text' });
      if (!selectedText) {
        alert("Please highlight some text first to add an annotation!");
        return;
      }

      // Check if we are already inside an annotation (to edit it)
      const existingNode = editor.selection.getNode().closest('.lesson-annotation');
      let initialText = '';
      let initialMediaType = 'none';
      let initialMediaUrl = '';

      if (existingNode) {
        initialText = decodeURIComponent(existingNode.getAttribute('data-annotation-text') || '');
        initialMediaType = existingNode.getAttribute('data-annotation-media-type') || 'none';
        initialMediaUrl = existingNode.getAttribute('data-annotation-media-url') || '';
      }

      // 2. Open dialog
      editor.windowManager.open({
        title: existingNode ? 'Edit Annotation' : 'Create Annotation',
        body: {
          type: 'panel',
          items: [
            {
              type: 'textarea',
              name: 'text',
              label: 'Annotation Text (Supports LaTeX, max 50 words recommended)'
            },
            {
              type: 'selectbox',
              name: 'mediaType',
              label: 'Media Type',
              items: [
                { text: 'None (Speech Bubble)', value: 'none' },
                { text: 'Image (Bottom Sheet)', value: 'image' },
                { text: 'Image (Fullscreen Frame)', value: 'image-frame' },
                { text: 'Interactive Map (Deep-dive)', value: 'interactive-image' },
                { text: 'Video (Bottom Sheet)', value: 'video' }
              ]
            },
            {
              type: 'input',
              name: 'mediaUrl',
              label: 'Media URL (For normal images/videos)'
            },
            {
              type: 'selectbox',
              name: 'interactiveMapId',
              label: 'Select Interactive Map (Only if above is Interactive Map)',
              items: [
                { text: 'Select a Map...', value: '' },
                ...getInteractiveMaps().map(m => ({ text: m.title, value: m.id }))
              ]
            }
          ]
        },
        initialData: {
          text: initialText,
          mediaType: initialMediaType,
          mediaUrl: initialMediaType === 'interactive-image' ? '' : initialMediaUrl,
          interactiveMapId: initialMediaType === 'interactive-image' ? initialMediaUrl : ''
        },
        buttons: [
          { type: 'cancel', text: 'Cancel' },
          { type: 'submit', text: existingNode ? 'Update' : 'Tag', primary: true }
        ],
        onSubmit: (api: any) => {
          const data = api.getData();
          if (!data.text.trim()) {
            alert("Annotation text is required.");
            return;
          }
          
          const finalMediaUrl = data.mediaType === 'interactive-image' ? data.interactiveMapId : data.mediaUrl.trim();
          const encodedText = encodeURIComponent(data.text.trim());
          const tagInlineStyle = "color: #6ee7b7; font-weight: 700; background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25)); border: 1px solid rgba(52, 211, 153, 0.6); border-radius: 6px; padding: 2px 7px; margin: 0 2px; box-shadow: 0 0 8px rgba(52, 211, 153, 0.35), inset 0 0 6px rgba(52, 211, 153, 0.15); cursor: pointer; display: inline-flex; align-items: center; text-decoration: none;";
          const html = `<span class="lesson-annotation mceNonEditable" style="${tagInlineStyle}" data-annotation-id="ann-${Date.now()}" data-annotation-text="${encodedText}" data-annotation-media-type="${data.mediaType}" data-annotation-media-url="${finalMediaUrl}">${selectedText}</span>`;
          
          editor.insertContent(html);
          api.close();
        }
      });
    }
  });

  // Handle clicking on existing annotations to edit them
  editor.on('click', (e: any) => {
    const target = e.target as HTMLElement;
    const annotationSpan = target.closest('.lesson-annotation');
    
    if (annotationSpan) {
      const text = decodeURIComponent(annotationSpan.getAttribute('data-annotation-text') || '');
      const mediaType = annotationSpan.getAttribute('data-annotation-media-type') || 'none';
      const mediaUrl = annotationSpan.getAttribute('data-annotation-media-url') || '';
      const innerText = annotationSpan.textContent || '';
      
      editor.windowManager.open({
        title: 'Edit Annotation',
        body: {
          type: 'panel',
          items: [
            {
              type: 'textarea',
              name: 'text',
              label: 'Annotation Text'
            },
            {
              type: 'selectbox',
              name: 'mediaType',
              label: 'Media Type',
              items: [
                { text: 'None (Speech Bubble)', value: 'none' },
                { text: 'Image (Bottom Sheet)', value: 'image' },
                { text: 'Image (Fullscreen Frame)', value: 'image-frame' },
                { text: 'Interactive Map (Deep-dive)', value: 'interactive-image' },
                { text: 'Video (Bottom Sheet)', value: 'video' }
              ]
            },
            {
              type: 'input',
              name: 'mediaUrl',
              label: 'Media URL'
            },
            {
              type: 'selectbox',
              name: 'interactiveMapId',
              label: 'Select Interactive Map (Only if above is Interactive Map)',
              items: [
                { text: 'Select a Map...', value: '' },
                ...getInteractiveMaps().map(m => ({ text: m.title, value: m.id }))
              ]
            }
          ]
        },
        initialData: {
          text: text,
          mediaType: mediaType,
          mediaUrl: mediaType === 'interactive-image' ? '' : mediaUrl,
          interactiveMapId: mediaType === 'interactive-image' ? mediaUrl : ''
        },
        buttons: [
          { type: 'custom', name: 'delete', text: 'Remove Tag', buttonType: 'secondary' },
          { type: 'cancel', text: 'Cancel' },
          { type: 'submit', text: 'Update', primary: true }
        ],
        onAction: (api: any, details: any) => {
          if (details.name === 'delete') {
            // Replace the span with just its text content
            annotationSpan.outerHTML = innerText;
            api.close();
          }
        },
        onSubmit: (api: any) => {
          const data = api.getData();
          if (!data.text.trim()) {
            alert("Annotation text is required.");
            return;
          }
          
          const finalMediaUrl = data.mediaType === 'interactive-image' ? data.interactiveMapId : data.mediaUrl.trim();
          const encodedText = encodeURIComponent(data.text.trim());
          const tagInlineStyle = "color: #6ee7b7; font-weight: 700; background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25)); border: 1px solid rgba(52, 211, 153, 0.6); border-radius: 6px; padding: 2px 7px; margin: 0 2px; box-shadow: 0 0 8px rgba(52, 211, 153, 0.35), inset 0 0 6px rgba(52, 211, 153, 0.15); cursor: pointer; display: inline-flex; align-items: center; text-decoration: none;";
          const html = `<span class="lesson-annotation mceNonEditable" style="${tagInlineStyle}" data-annotation-id="${annotationSpan.getAttribute('data-annotation-id')}" data-annotation-text="${encodedText}" data-annotation-media-type="${data.mediaType}" data-annotation-media-url="${finalMediaUrl}">${innerText}</span>`;
          
          annotationSpan.outerHTML = html;
          api.close();
        }
      });
    }
  });
};
