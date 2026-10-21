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
  const openAnnotationDialog = (existingNode: HTMLElement | null = null, selectedText: string = '') => {
    let initialText = '';
    let initialMediaType = 'image-frame';
    let initialMediaUrl = '';
    const innerText = existingNode ? (existingNode.textContent || '') : selectedText;

    if (existingNode) {
      initialText = decodeURIComponent(existingNode.getAttribute('data-annotation-text') || '');
      initialMediaType = existingNode.getAttribute('data-annotation-media-type') || 'image-frame';
      initialMediaUrl = existingNode.getAttribute('data-annotation-media-url') || '';
    }

    const previewHtml = initialMediaUrl ? `
      <div style="margin: 8px 0; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; text-align: center;">
        <div style="font-size: 10px; font-weight: bold; color: #38bdf8; margin-bottom: 6px; text-transform: uppercase; font-family: monospace;">Attached Media Preview:</div>
        <img src="${initialMediaUrl}" style="max-height: 160px; max-width: 100%; border-radius: 6px; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" onerror="this.style.display='none'" />
        <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; word-break: break-all;">${initialMediaUrl}</div>
      </div>
    ` : '';

    const dialogItems: any[] = [
      {
        type: 'textarea',
        name: 'text',
        label: 'Annotation Text / Caption (Supports LaTeX)'
      },
      {
        type: 'selectbox',
        name: 'mediaType',
        label: 'Media Type',
        items: [
          { text: 'Image (Fullscreen Frame / Lightbox)', value: 'image-frame' },
          { text: 'Image (Interactive Modal)', value: 'image' },
          { text: 'None (Speech Bubble)', value: 'none' },
          { text: 'Interactive Map (Deep-dive)', value: 'interactive-image' },
          { text: 'Video (Lecture Stream)', value: 'video' }
        ]
      },
      {
        type: 'input',
        name: 'mediaUrl',
        label: 'Media URL (Image / Video link)'
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
    ];

    if (previewHtml) {
      dialogItems.push({
        type: 'htmlpanel',
        html: previewHtml
      });
    }

    editor.windowManager.open({
      title: existingNode ? 'Edit Tag & Attached Media' : 'Create Tag & Attach Media',
      body: {
        type: 'panel',
        items: dialogItems
      },
      initialData: {
        text: initialText,
        mediaType: initialMediaType,
        mediaUrl: initialMediaType === 'interactive-image' ? '' : initialMediaUrl,
        interactiveMapId: initialMediaType === 'interactive-image' ? initialMediaUrl : ''
      },
      buttons: [
        { type: 'custom', name: 'uploadMedia', text: '📁 Upload Image File', buttonType: 'secondary' },
        ...(initialMediaUrl ? [{ type: 'custom', name: 'previewMedia', text: '🔍 View Media Full Size', buttonType: 'secondary' }] : []),
        ...(existingNode ? [{ type: 'custom', name: 'delete', text: 'Remove Tag', buttonType: 'secondary' }] : []),
        { type: 'cancel', text: 'Cancel' },
        { type: 'submit', text: existingNode ? 'Update Tag' : 'Apply Tag', primary: true }
      ],
      onAction: async (api: any, details: any) => {
        if (details.name === 'uploadMedia') {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.onchange = async (ev: any) => {
            const file = ev.target?.files?.[0];
            if (!file) return;
            try {
              const { uploadImageToStorage } = await import('./firebaseHelper');
              const downloadUrl = await uploadImageToStorage(file, 'images/annotations');
              api.setData({
                mediaUrl: downloadUrl,
                mediaType: 'image-frame'
              });
              alert(`Image '${file.name}' uploaded successfully! Click '${existingNode ? 'Update Tag' : 'Apply Tag'}' to save.`);
            } catch (err: any) {
              alert('Failed to upload image: ' + err.message);
            }
          };
          fileInput.click();
        } else if (details.name === 'previewMedia') {
          const currentData = api.getData();
          const url = currentData.mediaUrl || initialMediaUrl;
          if (url) {
            window.open(url, '_blank');
          } else {
            alert('No media URL attached to preview.');
          }
        } else if (details.name === 'delete') {
          if (existingNode) {
            existingNode.outerHTML = innerText;
          }
          api.close();
        }
      },
      onSubmit: (api: any) => {
        const data = api.getData();
        const rawMediaUrl = data.mediaType === 'interactive-image' ? data.interactiveMapId : data.mediaUrl.trim();
        let finalMediaType = data.mediaType;

        // Auto-upgrade mediaType if an image/video URL is provided so images are NEVER ignored
        if (rawMediaUrl && finalMediaType === 'none') {
          finalMediaType = 'image-frame';
        }

        const textToUse = data.text.trim() || (rawMediaUrl ? 'Attached Illustration' : 'Annotation Detail');
        const finalMediaUrl = rawMediaUrl;
        const encodedText = encodeURIComponent(textToUse);
        const tagInlineStyle = "color: #6ee7b7; font-weight: 700; background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25)); border: 1px solid rgba(52, 211, 153, 0.6); border-radius: 6px; padding: 2px 7px; margin: 0 2px; box-shadow: 0 0 8px rgba(52, 211, 153, 0.35), inset 0 0 6px rgba(52, 211, 153, 0.15); cursor: pointer; display: inline-flex; align-items: center; text-decoration: none;";
        const titleTooltip = finalMediaUrl ? '🖼️ Attached Media: Click to view' : 'Click to view annotation';
        const html = `<span class="lesson-annotation mceNonEditable" style="${tagInlineStyle}" data-annotation-id="${existingNode?.getAttribute('data-annotation-id') || 'ann-' + Date.now()}" data-annotation-text="${encodedText}" data-annotation-media-type="${finalMediaType}" data-annotation-media-url="${finalMediaUrl}" title="${titleTooltip}">${innerText}</span>`;

        if (existingNode) {
          existingNode.outerHTML = html;
        } else {
          editor.insertContent(html);
        }
        api.close();
      }
    });
  };

  editor.ui.registry.addButton('annotation', {
    text: 'Tag',
    tooltip: 'Add Interactive Annotation / Media Tag',
    icon: 'bookmark',
    onAction: () => {
      const selectedText = editor.selection.getContent({ format: 'text' });
      const existingNode = editor.selection.getNode().closest('.lesson-annotation');
      if (!selectedText && !existingNode) {
        alert("Please highlight some text first to add an annotation!");
        return;
      }
      openAnnotationDialog(existingNode, selectedText);
    }
  });

  // Handle clicking on existing annotations in TinyMCE to edit / preview them
  editor.on('click', (e: any) => {
    const target = e.target as HTMLElement;
    const annotationSpan = target.closest('.lesson-annotation');
    if (annotationSpan) {
      openAnnotationDialog(annotationSpan as HTMLElement, annotationSpan.textContent || '');
    }
  });
};
