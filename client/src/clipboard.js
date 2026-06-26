export async function copyToClipboard(text) {
  const value = String(text ?? '');
  if (!value) {
    throw new Error('Nothing to copy.');
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back below — common on HTTP deployments without a secure context.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copied) {
    throw new Error('Copy failed. Select the text and copy manually.');
  }
}
