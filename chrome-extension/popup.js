document.getElementById('capture').addEventListener('click', async () => {
  // Send message to background to capture the tab
  chrome.runtime.sendMessage({ action: 'capture' });
  window.close();
});
