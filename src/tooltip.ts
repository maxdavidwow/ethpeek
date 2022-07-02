import tippy from 'tippy.js';

export function hookTooltip(el: HTMLSpanElement) {
  const id = el.innerText.trim();

  tippy(el, {
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
        }[], tokensValue?: number, failed?: boolean
      }) => {
        // console.log(info);
        if (info.failed) {
          instance?.setContent(`Failed to fetch address.`);
        } else {
          instance?.setContent(`<ethtooltip>
            <div class="header">${info.ens ? (info.ens + ' / ') : ''}${info.address}</div>
            <div class="balance"><span>Ξ${info.ether.toFixed(4)}</span><span>$${info.etherValue.toFixed(0)}</span></div>
            <div class="tokensvalue"><span>Tokens</span><span>$${info.tokensValue?.toFixed(0)}</span></div>
            <div class="tokens">
              ${info.tokens?.map(token => `<div class="token">
              <span><img src="${token.img}"/><div class="symbol">${token.symbol}</div> ${token.amount.toFixed(0)}</span><span>$${token.value.toFixed(0)}</span></div>`).join('')}
              ${info.remainingTokensValue ? `<div class="token"><span>Other tokens</span><span>$${info.remainingTokensValue?.toFixed(0)}</span></div>` : ''}
            </div>
          </ethtooltip>`);
        }
      });
    }
  });
}
