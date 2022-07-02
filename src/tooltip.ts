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
      }, (info: { address: string, ens?: string, ether: number, etherValue: number, remainingTokensValue?: number, tokens?: {}[], tokensValue?: number }) => {
        console.log(info);
        instance.setContent(`<ethtooltip>
          <div style="font-size: 12px;">${info.ens ? (info.ens + ' / ') : ''}${info.address}</div>
          <div>${info.ether.toFixed(4)} = $${info.etherValue.toFixed(2)}</div>

        </ethtooltip>`);
      });
    }
  });
}
