import tippy from 'tippy.js';

const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const ether = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function hookTooltip(el: Element, id: string) {
  const isEns = !id.startsWith('0x');
  tippy(el, {
    delay: 200,
    duration: 0,
    arrow: false,
    maxWidth: 'none',
    theme: 'linkthereum',
    allowHTML: true,
    offset: [0, 0],
    content: 'Fetching address...',
    onShow: (instance) => {
      chrome.runtime.sendMessage({
        type: 'ADDRESS_REQUEST',
        id
      }, (info: {
        address: string, ens?: string, ether: number, etherValue: number, remainingTokensValue?: number, tokens?: {
          amount: number,
          img: string,
          symbol: string,
          value: number
        }[], tokensValue?: number, tag?: string, tokenCount: number, failed?: boolean
      }) => {
        // console.log(info);
        if (info.failed) {
          instance?.setContent(`Failed to fetch address.`);
        } else {
          instance?.setContent(`<ethtooltip>
            <div class="header">${info.tag || info.ens || info.address}</div>
            <div class="balance"><span>Ξ${ether.format(info.ether)}</span><span>${usd.format(info.etherValue)}</span></div>
            <div class="tokensvalue"><span>${info.tokenCount > 99 ? '> 100' : info.tokenCount} tokens</span><span>${usd.format(info.tokensValue || 0)}</span></div>
            ${info.tokens?.length ? `
              <div class="tokens">
                ${info.tokens?.map(token => `<div class="token">
                <span><img src="${token.img}"/><div class="symbol">${token.symbol}</div> ${amount.format(token.amount)}</span><span>${usd.format(token.value)}</span></div>`).join('')}
                ${info.remainingTokensValue ? `<div class="token"><span>Other tokens</span><span>${usd.format(info.remainingTokensValue)}</span></div>` : ''}
              </div>
            ` : ''}
          </ethtooltip>`);
        }
      });
    }
  });
}
