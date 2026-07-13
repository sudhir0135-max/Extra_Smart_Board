const React = require('react');
const { renderToString } = require('react-dom/server');
const { performance } = require('perf_hooks');

const mockPages = Array.from({ length: 500 }).map((_, i) => ({
  pageNumber: i + 1,
  content: `
    <h1>Chapter Section ${i}</h1>
    <p>This is a paragraph of text meant to simulate typical educational content length. It contains <b>bold</b> and <i>italic</i> tags.</p>
    <ul>
      <li>Bullet point 1</li>
      <li>Bullet point 2</li>
      <li>Bullet point 3</li>
    </ul>
    <p>Equation here: $$E = mc^2$$ and maybe a display equation:</p>
    <div class="callout">Important note about this section.</div>
    <table>
      <tr><th>Header 1</th><th>Header 2</th></tr>
      <tr><td>Data 1</td><td>Data 2</td></tr>
      <tr><td>Data 3</td><td>Data 4</td></tr>
    </table>
  `
}));

function MockWorkspace() {
  const sanitizedPages = mockPages.map(page => ({
    ...page,
    _cleanContent: page.content
  }));

  return React.createElement('div', { id: 'main', className: 'flex-1 flex flex-col' },
    React.createElement('div', { id: 'content-scroll', className: 'flex-1 overflow-y-auto' },
      React.createElement('div', { id: 'seamless-pdf-stack', className: 'w-full flex flex-col items-stretch transition-all' },
        sanitizedPages.map((page, index) => 
          React.createElement('div', { key: index, className: 'relative px-[2%] py-6' },
            React.createElement('div', { className: 'absolute right-6 top-3 text-[9px]' }, page.pageNumber),
            React.createElement('div', { 
              className: 'font-serif reader-content', 
              dangerouslySetInnerHTML: { __html: page._cleanContent }
            })
          )
        )
      )
    )
  );
}

const start = performance.now();
const html = renderToString(React.createElement(MockWorkspace));
const end = performance.now();

const htmlSizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(2);
const tagMatch = html.match(/<[a-zA-Z1-6]+/g);
const domNodes = tagMatch ? tagMatch.length : 0;
const heightEstimatePx = mockPages.length * 1000; 

const memoryUsage = process.memoryUsage();

console.log(JSON.stringify({
  pages: mockPages.length,
  reactRenderTimeMs: (end - start).toFixed(2),
  htmlSizeKb: htmlSizeKb,
  baselineDomNodes: domNodes,
  estimatedHeightPx: heightEstimatePx,
  memoryHeapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
}, null, 2));
