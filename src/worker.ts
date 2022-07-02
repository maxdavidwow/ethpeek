import ENS from 'ethjs-ens';
import HttpProvider from 'ethjs-provider-http';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    fetchOnHover: false,
    requireCntrl: false
  });
});

function parseValue(usd: string | undefined | null) {
  if (!usd) return 0;
  return Number(usd.replace(/\$|,/g, ''));
}

const parser = new DOMParser();

const ens = new ENS({ provider: new HttpProvider('https://cloudflare-eth.com/'), network: '1' })
const CACHE: { [addressOrEns: string]: unknown } = {};

async function fetchAddress(message: any, sendResponse: (response?: any) => void) {
  let address: string;
  let ensName: string;
  let addressOrEns = message.id;

  const cached = CACHE[addressOrEns];
  if (cached) {
    const response = await Promise.resolve(cached);
    sendResponse(response);
    return;
  }

  let ensPromise: Promise<unknown>;
  if (addressOrEns.startsWith('0x')) {
    address = addressOrEns;
    ensPromise = ens.reverse(address).catch(() => undefined).then(name => ensName = name);
  } else {
    const resolved = await ens.lookup(addressOrEns).catch(() => undefined);
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
    const ethscan = parser.parseFromString(await r.text(), 'text/html');

    let ether = 0;
    let etherValue = 0;
    ethscan.querySelectorAll<HTMLDivElement>('div.col-md-8').forEach(el => {
      if (el.innerText?.endsWith(' Ether')) {
        ether = parseValue(el.innerText.replace(' Ether', ''));
      }
      if (el.innerText?.startsWith('$')) {
        etherValue = parseValue(el.innerText.split(' (')[0]);
      }
    });

    const tokens = Array.from(ethscan.querySelectorAll('.list-custom-ERC20'))
      .map(li => {
        const symbol = li.querySelector<HTMLSpanElement>('.list-name')?.innerText?.split(' (')?.[1]?.replace(')', '');
        const img = 'https://etherscan.io/token/' + li.querySelector('img')?.src?.split('/token')?.[1];
        const amount = parseValue(li.querySelector<HTMLSpanElement>('.list-amount')?.innerText?.split(' ')?.[0]);
        const value = parseValue(li.querySelector<HTMLSpanElement>('.list-usd-value')?.innerText);
        return { symbol, img, amount, value };
      })
      .sort((a, b) => a.value - b.value)
      .slice(-3)
      .reverse();
    const allTokensValue = parseValue(ethscan.querySelector<HTMLAnchorElement>('#availableBalanceDropdown')?.innerText?.split('$')?.[1].split('.')?.[0]);
    const tokenValue = tokens.reduce((p, c) => p + c.value, 0);

    if (ensPromise! !== undefined) await ensPromise;
    const response = {
      type: 'ADDRESS_RESPONSE',
      address: address!,
      ens: ensName!,
      ether,
      etherValue,
      tokens,
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
  if (message.type !== 'ADDRESS_REQUEST') return false;
  fetchAddress(message, sendResponse);
  return true;
});
