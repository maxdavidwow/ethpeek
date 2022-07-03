chrome.storage.sync.get(['blacklist', 'lastEnsReset'], storage => {
  chrome.tabs.query({ active: true }).then(tabs => {
    const bl = storage.blacklist;

    const tab = tabs[0];
    const origin = new URL(tab.url || tab.pendingUrl!).origin;
    const isBlocked = bl[origin];

    const h3 = document.querySelector<HTMLHeadingElement>('#origin>h3')!;
    h3.innerText = origin;
    h3.className = isBlocked ? 'blocked' : 'active';

    const btn = document.querySelector<HTMLButtonElement>('#origin>button')!;
    btn.innerText = isBlocked ? 'Activate' : 'Block';
    btn.className = isBlocked ? 'active' : 'blocked';
    btn.onclick = () => {
      bl[origin] = !isBlocked;
      chrome.storage.sync.set({ blacklist: bl }, () => {
        chrome.tabs.reload(tab.id!);
        window.location.reload();
      });
    };

    const h4 = document.querySelector<HTMLHeadingElement>('#ens>h4')!;
    h4.innerText = 'Last reset: ' + Math.round((new Date(storage.lastEnsReset).valueOf() - new Date().valueOf()) / (1000 * 60 * 60 * 24)) + ' days ago';

    const btnEns = document.querySelector<HTMLButtonElement>('#ens>button')!;
    btnEns.onclick = () => chrome.storage.sync.set({ lastEnsReset: Date.now() }, () => {
      chrome.runtime.sendMessage({ type: 'RESET_CACHE' });
      chrome.tabs.reload(tab.id!);
      window.location.reload();
    });
  });
});
