const fs = require('fs');

const content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

// Find all imports from lucide-react
const importMatch = content.match(/import\s*{([^}]+)}\s*from\s*'lucide-react'/);
const importedTags = importMatch ? importMatch[1].split(',').map(s => s.trim().split(' as ')[0]) : [];

console.log("Imported tags:", importedTags);

// Find all <Tag ... /> or <Tag>
const tagMatches = [...content.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1]);
const uniqueTags = [...new Set(tagMatches)];

console.log("All uppercase tags used:", uniqueTags);

const missing = uniqueTags.filter(tag => {
  // Ignore standard React components that might be in scope or from other imports
  if (['AdminPanel', 'RichTextEditor', 'FlashQuestionManager'].includes(tag)) return false;
  return !importedTags.includes(tag);
});

console.log("Potentially missing Lucide icons:", missing);
