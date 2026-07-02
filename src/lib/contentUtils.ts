export const hasTextContent = (html: string | undefined | null): boolean => {
  if (!html) return false;
  
  // Check for any images embedded in the rich text (base64 or URLs)
  if (html.includes('<img')) return true;

  // Remove HTML tags to check if there is actual text
  const stripped = html.replace(/<[^>]*>?/gm, '').trim();
  
  // If the string length is greater than 0, it has text content
  // Exclude common blank editor remnants like zero-width spaces or purely empty tags
  return stripped.length > 0 && stripped !== '&nbsp;';
};
