import { hookTooltip } from "./tooltip";

function isTooltip(node: HTMLElement) {
  return node.className?.includes?.('tooltip');
}
function isUnsuitable(node: HTMLElement) {
  switch (node.tagName) {
    case 'NOSCRIPT':
    case 'SCRIPT':
    case 'STYLE':
    case 'BUTTON':
    case 'INPUT':
    case 'ETHLINK':
    case 'ETHTOOLTIP':
      return true;
    default:
      return isTooltip(node);
  }
}
function hasValidParent(text: Text) {
  if (text.parentElement) {
    if (isUnsuitable(text.parentElement)) {
      return false;
    } else {
      if (text.parentElement.parentElement) {
        if (isUnsuitable(text.parentElement.parentElement)) {
          return false;
        } else {
          return true;
        }
      } else {
        return true;
      }
    }
  } else {
    return true;
  }
}
function isInsideLink(el: Node) {
  return el.parentElement?.tagName === 'A' ||
    el.parentElement?.parentElement?.tagName === 'A' ||
    el.parentElement?.parentElement?.parentElement?.tagName === 'A';
}

function handleEthlink(child: HTMLSpanElement, insideLink: boolean) {
  const id = child.innerText.trim().toLowerCase();
  const isEns = !id.startsWith('0x');
  if (isEns) {
    chrome.runtime.sendMessage({
      type: 'ENS_RESOLVE',
      id
    }, (resolved: { address: string, failed?: boolean }) => {
      if (resolved.failed) return;
      hookTooltip(child, resolved.address);
      if (!insideLink) {
        child.className = 'styled';
        const a = document.createElement('a');
        a.href = `https://etherscan.io/address/${resolved.address}`;
        a.innerText = id;
        child.childNodes[0].replaceWith(a);
      }
    });
  } else {
    hookTooltip(child, id);
    if (!insideLink) {
      (child as Element).className = 'styled';
      const a = document.createElement('a');
      if (!isEns) a.href = `https://etherscan.io/address/${id}`;
      a.innerText = id;
      child.childNodes[0].replaceWith(a);
    }
  }
}

function scan(nodeToScan: Node) {
  // const start = performance.now();
  const replacements: [string, Text][] = [];
  const tw = document.createTreeWalker(nodeToScan, NodeFilter.SHOW_TEXT, null);
  let node = tw.nextNode() as Text;
  while (node) {
    if (node.length > 6 && hasValidParent(node)) {
      let matches = 0;
      const replaced = node.data.replace(
        // regex for ENS and 0x addresses
        /0x[a-fA-F0-9]{40}|[-a-zA-Z0-9@:%._+~#=]{1,256}\.eth\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?/g,
        m => { matches++; return `<ethlink>${m}</ethlink>`; }
      );
      if (matches > 0) {
        replacements.push([replaced, node]);
      }
    }
    node = tw.nextNode() as Text;
  }
  for (const replacement of replacements) {
    const d = document.createElement('div');
    d.innerHTML = replacement[0];
    const insideLink = isInsideLink(replacement[1] as Node);
    for (const child of d.childNodes) {
      if ((child as Element)?.tagName === 'ETHLINK') {
        handleEthlink(child as HTMLSpanElement, insideLink);
      }
    }
    replacement[1].replaceWith(...d.childNodes);
  }
  // const ms = ((performance.now() - start));
  // if (ms > 1 || replacements.length > 0) {
  //   console.log(ms.toFixed(0) + 'ms', replacements);
  // }
}

chrome.storage.sync.get('blacklist', storage => {
  const isBlocked = storage.blacklist[window.location.origin];
  if (!isBlocked) {
    requestIdleCallback(() => {
      // initial scan
      scan(document.body);

      new MutationObserver(mutationList => {
        for (const mutation of mutationList) {
          for (const addedNode of mutation.addedNodes) {
            scan(addedNode);
          }
        }
      }).observe(document.body, { attributes: false, childList: true, subtree: true });
    }, { timeout: 6000 });
  }
});
