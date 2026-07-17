// Test: Does DOMParser corrupt backslashes in text nodes?
// This simulates what stripInlineStyles does to the Firebase content

// The actual content from Firebase (as stored):
// <p>fraction = $\frac{2}{3}$</p>
// <p>fraction = \(\frac{1}{2}\)</p>

// In the browser, DOMParser parses this HTML string.
// Text nodes in <p> are plain text - backslashes are NOT special in HTML text.
// When browser serializes back via .innerHTML, text nodes should NOT encode backslashes.
// HOWEVER: the issue is how Firestore/JSON delivers this to the browser.

// The Firebase data (as shown in scratch5.mjs output with JSON.stringify):
// "RAW MATCH: \"<p>fraction = $\\\\frac{2}{3}$</p>\""
// JSON.stringify doubles the backslashes: \\frac in JSON = \frac in the actual string
// So the actual stored string is: <p>fraction = $\frac{2}{3}$</p>
// This is correct! The backslash IS preserved.

// So the question becomes: does DOMParser.parseFromString preserve \frac in text nodes?
// Answer: YES! Backslash is not special in HTML - it's just a character.

// SO THE BUG IS NOT IN stripInlineStyles.

// Let me reconsider... Looking at the screenshot again:
// "fraction = $\frac{2}{3}$" -- the backslash IS visible in the screenshot
// "fraction = \(\frac{1}{2}\)" -- also showing raw

// This means renderMathInElement is NOT processing the text nodes.

// POSSIBLE CAUSES:
// 1. The function is not being called at all
// 2. The function IS called but fails silently  
// 3. The text is inside an element that is in ignoredTags
// 4. The function runs BEFORE the content is in the DOM (timing)

// Let me check: what does the content div hierarchy look like?
// VirtualPageWrapper (outer div, ref.current)
//   └─ children (passed as prop - the inner div + content)
//       └─ div.pdf-page-N
//           └─ div.flex-1
//               └─ div.font-serif.reader-content (dangerouslySetInnerHTML)
//                   └─ <p>fraction = $\frac{2}{3}$</p>

// renderMathInElement scans ref.current (the outer div) and all descendants.
// It SHOULD find the text node inside <p>.

// WAIT! I see it now! Look at the content stored in Firebase:
// <p>fraction = $\frac{2}{3}$</p>
//
// The $ sign is NOT special in HTML. But \frac has a BACKSLASH.
// In HTML, & is the escape character, not \.
// So <p>fraction = $\frac{2}{3}$</p> is valid HTML where:
// - "fraction = " is text
// - "$\frac{2}{3}$" is the literal text with $ and \ chars
//
// renderMathInElement walks text nodes and looks for delimiters.
// For "$...$", it looks for $ character in text nodes.
// For "\(...\)", it looks for \( sequence.
// BOTH of these should be found in the text nodes!

// UNLESS... the content is actually stored as:
// <p>fraction = $<em>frac{2}{3}</em>$</p>
// where TinyMCE has interpreted \ as something special and wrapped parts in tags

// Or UNLESS the content uses HTML entities like &bsol; for backslash

// The Firebase raw output shows: $\\frac{2}{3}$ which in actual string = $\frac{2}{3}$
// and \\(\\frac{1}{2}\\) which in actual string = \(\frac{1}{2}\)
// THESE ARE CORRECT FORMAT FOR KATEX AUTO-RENDER

// So why isn't it rendering?
// THEORY: The content goes through stripInlineStyles which uses DOMParser.
// DOMParser parses the HTML and creates DOM nodes.
// When it serializes back to innerHTML, does it encode the \ ?

// In browsers, innerHTML serializes text nodes by HTML-encoding:
// < → &lt;
// > → &gt;  
// & → &amp;
// But NOT backslash \ - that's NOT HTML special!

// So stripInlineStyles SHOULD preserve the backslashes correctly.

// NEW THEORY: Maybe renderMathInElement IS working and rendering math,
// but the RENDERED MATH is then getting STRIPPED by stripInlineStyles
// because KaTeX HTML has inline styles (color, etc.)
// and stripInlineStyles removes inline styles!
// But stripInlineStyles has a guard: if (el.closest('.katex')) return;
// So KaTeX elements should be protected.

// BUT WAIT! Look at the order of operations:
// 1. sanitizedPages = useMemo(() => stripInlineStyles(content), [lesson.id])
// 2. page._cleanContent is the ALREADY STRIPPED content 
// 3. This stripped HTML is set as dangerouslySetInnerHTML
// 4. THEN useLayoutEffect fires and runs renderMathInElement on the DOM

// Since stripInlineStyles runs on raw content BEFORE KaTeX renders anything,
// there are NO .katex elements to protect - they don't exist yet!
// So stripInlineStyles cannot be damaging KaTeX output.

// FINAL CONCLUSION:
// The issue MUST be that renderMathInElement is not finding/processing the text.
// The most likely cause is that there's an ERROR being thrown silently,
// or the function isn't resolving properly.

// Let me add a direct test with a simple approach:
// Instead of relying on auto-render, directly use katex.renderToString
// in a React component that processes the content string before setting innerHTML.

console.log("Analysis complete. Solution: Pre-process math in HTML string before render.");
