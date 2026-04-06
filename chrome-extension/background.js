// FeatherShot — Background Service Worker
// On icon click: inject selection overlay into the active tab

chrome.action.onClicked.addListener(async (tab) => {
  // Inject the selector CSS and JS into the active tab
  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['selector.css']
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['selector.js']
    });
  } catch (err) {
    console.error('Failed to inject selector:', err);
  }
});

// Listen for area selection from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'area-selected') {
    const crop = message.crop;

    // Capture the visible tab
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Capture failed:', chrome.runtime.lastError.message);
        return;
      }

      // Store screenshot + crop parameters and open editor
      chrome.storage.local.set({
        screenshotData: dataUrl,
        cropRegion: crop
      }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
      });
    });
  }
});
