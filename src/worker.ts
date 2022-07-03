chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    fetchOnHover: false,
    requireCntrl: false,
    blacklist: {},
    ensCache: {},
    lastEnsReset: Date.now()
  });
});

function parseValue(usd: string | undefined | null) {
  if (!usd) return 0;
  return Number(usd.replace(/\$|,/g, ''));
}

function cutStr<T = string>(str: string, startIdx: number, from: string, fromExpand: string | null, to: string, defaultValue: T, regex?: RegExp, format?: (s: string) => T) {
  try {
    let idx = str.indexOf(from, startIdx);
    if (idx === -1) throw -1;
    idx += from.length;
    if (fromExpand) {
      const endIdx = str.indexOf(fromExpand, idx);
      if (endIdx === -1) throw -1;
      idx = endIdx + fromExpand.length;
    }
    const toIdx = str.indexOf(to, idx);
    const cut = str.substring(idx, toIdx);
    const cleaned = regex ? cut.replace(regex, '') : cut;
    const result = format ? format(cleaned) : cleaned;
    return [result as T, toIdx] as const;
  } catch {
    return [defaultValue, startIdx] as const;
  }
}

let ENS_MAP: { [addressOrEns: string]: string | Promise<string | null> } = {};
chrome.storage.sync.get('ensCache', storage => ENS_MAP = storage.ensCache);
chrome.runtime.onSuspend.addListener(() => chrome.storage.sync.set({ ensCache: ENS_MAP }));

async function resolveEnsName(id: string) {
  const cached = ENS_MAP[id];
  if (cached) return await Promise.resolve(cached);
  const loopup = new Promise<string | null>(async r => {
    const res = await fetch('https://etherscan.io/enslookup-search?search=' + id);
    const ethscan = await res.text();
    const [address] = cutStr<string | null>(ethscan, 100, `='txtEthereumAddress`, '>', '</span>', null);
    if (address) {
      ENS_MAP[address] = id;
      ENS_MAP[id] = address;
      r(address);
    } else {
      r(null);
    }
  });
  ENS_MAP[id] = loopup;
  return await loopup;
}
async function reverseEnsLookup(address: string) {
  const cached = ENS_MAP[address];
  if (cached) return await Promise.resolve(cached);
  const res = await fetch('https://etherscan.io/enslookup-search?search=' + address);
  const ethscan = await res.text();
  const [ens] = cutStr<string | null>(ethscan, 100, `alt='ETH'`, '>', '</span>', null);
  if (ens) {
    ENS_MAP[ens] = address;
    ENS_MAP[address] = ens;
    return ens;
  } else {
    return null;
  }
}

let CACHE: { [addressOrEns: string]: unknown } = {};
async function fetchAddress(message: any, sendResponse: (response?: any) => void) {
  let address: string | null;
  let ensName: string | null;
  let addressOrEns = message.id.toLowerCase();

  const cached = CACHE[addressOrEns];
  if (cached) {
    const response = await Promise.resolve(cached);
    sendResponse(response);
    return;
  }

  if (addressOrEns.startsWith('0x')) {
    address = addressOrEns;
    ensName = await Promise.resolve(ENS_MAP[address!]);
  } else {
    const resolved = await resolveEnsName(addressOrEns);
    if (resolved) {
      address = resolved;
      ensName = addressOrEns;
    } else {
      sendResponse({
        type: 'ADDRESS_RESPONSE',
        address: address!,
        ens: addressOrEns,
        failed: true
      });
    }
  }

  try {
    const r = await fetch('https://etherscan.io/address/' + address!);
    let ethscan = (await r.text());

    let [tag] = cutStr(ethscan, 0, 'og:title', `="`, 'Address', '');
    if (tag) tag = tag.substring(0, tag.length - 3);

    // cut the dom string to what we need
    ethscan = ethscan.substring(ethscan.indexOf('col-md-8') - 2);

    const [ether, ethIdx] = cutStr(ethscan, 0, 'col-md-8', '>', '</div>', 0, /\sEther|<b>|<\/b>|,/g, parseValue);
    const [etherValue, ethVIdx] = cutStr(ethscan, ethIdx, 'col-md-8', '>', '<span', 0, /\s|\$|,/g, parseValue);

    const [allTokensValue, atvIdx] = cutStr(ethscan, ethVIdx, 'availableBalanceDropdown', '>', '<span', 0, />|\s|\$|,/g, parseValue);

    // cut even more for token parsing
    ethscan = ethscan.substring(atvIdx);

    let lastTokenIdx = ethscan.indexOf('list-custom-ERC20');
    let tokens: { symbol, img, amount, value }[] = [];
    let moreTokens = lastTokenIdx >= 0;
    while (moreTokens) {
      const [img, imgIdx] = cutStr<string | null>(ethscan, lastTokenIdx, 'list-custom-ERC20', `<img src='`, `'`, null);
      if (img === null) break;
      const [amount, amtIdx] = cutStr(ethscan, imgIdx, `class='list-amount`, '>', ' ', 0, undefined, parseValue);
      const [symbol, symIdx] = cutStr(ethscan, amtIdx, ' ', null, '</span>', null);
      const [value, valIdx] = cutStr(ethscan, symIdx, '<span', '>', '</span>', 0, undefined, s => parseValue(s) || 0);
      tokens.push({ symbol, img, amount, value });
      lastTokenIdx = valIdx;
    }
    const tokenCount = tokens.length;
    tokens = tokens.sort((a, b) => a.value - b.value).slice(-3).reverse();
    tokens.forEach(t => t.img = 'https://etherscan.io' + t.img);
    const tokenValue = tokens.reduce((p, c) => p + c.value, 0);

    if (!ensName!) {
      const [parsedEns] = cutStr(ethscan, Math.max(lastTokenIdx, 1), `id='ensName'`, '> ', '</a>', null, /\s/g);
      if (parsedEns) ensName = parsedEns;
    }

    const response = {
      type: 'ADDRESS_RESPONSE',
      address: address!,
      ens: ensName!,
      tag,
      ether,
      etherValue,
      tokens,
      tokenCount,
      tokensValue: allTokensValue,
      remainingTokensValue: allTokensValue > tokenValue ? (allTokensValue - tokenValue) : undefined
    };
    CACHE[address!] = response;
    CACHE[ensName!] = response;
    sendResponse(response);
  } catch (ex) {
    console.error(ex);
    sendResponse({
      type: 'ADDRESS_RESPONSE',
      address: address!,
      ens: ensName!,
      failed: true
    });
  }
}

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  switch (message.type) {
    case 'ENS_RESOLVE':
      resolveEnsName(message.id).then(address => {
        if (address) {
          sendResponse({ type: 'ENS_RESPONSE', address });
        } else {
          sendResponse({ type: 'ENS_RESPONSE', failed: true });
        }
      });
      return true;
    case 'ADDRESS_REQUEST':
      fetchAddress(message, sendResponse);
      return true;
    case 'RESET_CACHE':
      ENS_MAP = {};
      CACHE = {};
      return false;
  }
  return false
});
