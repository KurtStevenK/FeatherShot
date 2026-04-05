// Capture immediately when the extension icon is clicked — no popup
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      console.error('Capture failed:', chrome.runtime.lastError.message);
      return;
    }
    // Store screenshot and open editor in a new tab
    chrome.storage.local.set({ screenshotData: dataUrl }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    });
  });
});
