chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'capture') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Capture failed:', chrome.runtime.lastError.message);
        return;
      }
      // Open the editor in a new tab, passing screenshot data via URL
      const editorUrl = chrome.runtime.getURL('editor.html');
      chrome.storage.local.set({ screenshotData: dataUrl }, () => {
        chrome.tabs.create({ url: editorUrl });
      });
    });
  }
});
