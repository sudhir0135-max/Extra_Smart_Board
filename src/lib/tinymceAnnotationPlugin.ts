export const setupTinyMceAnnotation = (editor: any) => {
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
                { text: 'Video (Bottom Sheet)', value: 'video' }
              ]
            },
            {
              type: 'input',
              name: 'mediaUrl',
              label: 'Media URL (Optional)'
            }
          ]
        },
        initialData: {
          text: initialText,
          mediaType: initialMediaType,
          mediaUrl: initialMediaUrl
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
          
          const encodedText = encodeURIComponent(data.text.trim());
          const html = `<span class="lesson-annotation mceNonEditable" style="color: #34d399; font-weight: bold; border-bottom: 2px dashed #34d399; cursor: pointer; padding: 0 2px; border-radius: 4px;" data-annotation-id="ann-${Date.now()}" data-annotation-text="${encodedText}" data-annotation-media-type="${data.mediaType}" data-annotation-media-url="${data.mediaUrl.trim()}">${selectedText}</span>`;
          
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
                { text: 'Video (Bottom Sheet)', value: 'video' }
              ]
            },
            {
              type: 'input',
              name: 'mediaUrl',
              label: 'Media URL'
            }
          ]
        },
        initialData: {
          text: text,
          mediaType: mediaType,
          mediaUrl: mediaUrl
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
          
          const encodedText = encodeURIComponent(data.text.trim());
          const html = `<span class="lesson-annotation mceNonEditable" style="color: #34d399; font-weight: bold; border-bottom: 2px dashed #34d399; cursor: pointer; padding: 0 2px; border-radius: 4px;" data-annotation-id="${annotationSpan.getAttribute('data-annotation-id')}" data-annotation-text="${encodedText}" data-annotation-media-type="${data.mediaType}" data-annotation-media-url="${data.mediaUrl.trim()}">${innerText}</span>`;
          
          annotationSpan.outerHTML = html;
          api.close();
        }
      });
    }
  });
};
